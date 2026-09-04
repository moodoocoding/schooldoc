import { useEffect, useState } from 'react';
import { getReceiptBook, listReceiptBooks, subscribeReceiptBooks } from './receiptBookStore';

export const useReceiptBooks = (ownerId: string) => {
  const [books, setBooks] = useState(() => listReceiptBooks(ownerId));
  useEffect(() => {
    const reload = () => setBooks(listReceiptBooks(ownerId));
    reload();
    return subscribeReceiptBooks(reload);
  }, [ownerId]);
  return books;
};

export const useReceiptBook = (ownerId: string, bookId: string) => {
  const [book, setBook] = useState(() => getReceiptBook(ownerId, bookId));
  useEffect(() => {
    const reload = () => setBook(getReceiptBook(ownerId, bookId));
    reload();
    return subscribeReceiptBooks(reload);
  }, [bookId, ownerId]);
  return book;
};
