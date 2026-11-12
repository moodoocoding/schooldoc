"""Render a locally generated HWPX with Hancom and verify all source text.

MoveDocBegin forces layout/viewport refresh before Hancom's PDF export. Hidden
COM instances can otherwise export a stale scroll origin and crop the first page.
This utility never opens an existing user's document or changes the source file.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import time
import pythoncom
from lxml import etree
import win32com.client

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("source", type=Path)
parser.add_argument("--output-dir", type=Path, required=True)
parser.add_argument("--expected-pages", type=int, required=True)
parser.add_argument("--pdftoppm", required=True)
parser.add_argument("--roundtrip", action="store_true")
args = parser.parse_args()
source, output = args.source.resolve(), args.output_dir.resolve()
if output.exists() and any(output.iterdir()):
    raise RuntimeError("Use a new empty output directory; preserve earlier evidence")
output.mkdir(parents=True, exist_ok=True)
from zipfile import ZipFile
with ZipFile(source) as archive:
    section = etree.fromstring(archive.read("Contents/section0.xml"))
    paragraphs = ["".join(p.itertext()) for p in section]
normalize = lambda text: "".join(text.split())
hwp = win32com.client.DispatchEx("HWPFrame.HwpObject")
try:
    hwp.XHwpWindows.Item(0).Visible = False
    hwp.RegisterModule("FilePathCheckDLL", "FilePathCheckerModule")
    if not hwp.Open(str(source), "HWPX", ""): raise RuntimeError("Hancom could not open document")
    hwp.HAction.Run("MoveDocBegin")
    actual_text = normalize(hwp.GetTextFile("TEXT", ""))
    missing = [i + 1 for i, p in enumerate(paragraphs) if normalize(p) not in actual_text]
    if missing: raise RuntimeError(f"Hancom text missing paragraphs: {missing}")
    pages = int(hwp.PageCount)
    if pages != args.expected_pages: raise RuntimeError(f"Expected {args.expected_pages}, got {pages} pages")
    hwp.SetPos(0, 0, 0)
    hwp.HAction.Run("MoveDocBegin")
    pythoncom.PumpWaitingMessages()
    time.sleep(0.2)
    pdf = output / "document.pdf"
    if not hwp.SaveAs(str(pdf), "PDF", ""): raise RuntimeError("PDF export failed")
    # Complete the PDF render before moving the caret for the edit test.
    subprocess.run([args.pdftoppm, "-scale-to", "1600", "-png", str(pdf), str(output / "page")], check=True, timeout=45, capture_output=True)
    roundtrip = False
    if args.roundtrip:
        hwp.HAction.Run("MoveDocEnd")
        hwp.HAction.GetDefault("InsertText", hwp.HParameterSet.HInsertText.HSet)
        hwp.HParameterSet.HInsertText.Text = "\nSchoolDoc editable roundtrip verification"
        hwp.HAction.Execute("InsertText", hwp.HParameterSet.HInsertText.HSet)
        edited = output / "roundtrip.hwpx"
        if not hwp.SaveAs(str(edited), "HWPX", ""): raise RuntimeError("Editable roundtrip save failed")
        if not hwp.Open(str(edited), "HWPX", ""): raise RuntimeError("Roundtrip reopen failed")
        roundtrip = "SchoolDoc editable roundtrip verification" in hwp.GetTextFile("TEXT", "")
        if not roundtrip: raise RuntimeError("Edited text missing after resave")
finally:
    hwp.Quit()
images = sorted(output.glob("page-*.png"))
if len(images) != pages: raise RuntimeError("PDF page count mismatch")
report = {"source": str(source), "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
          "hancom_open": True, "all_paragraphs_preserved": True,
          "expected_pages": args.expected_pages, "actual_pages": pages,
          "editable_roundtrip": roundtrip,
          "layout_refresh": "MoveDocBegin", "page_images": [str(p) for p in images],
          "visual_review": "not_run"}
(output / "verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(report, ensure_ascii=False))
