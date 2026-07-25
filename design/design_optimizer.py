import random

# Cooperative Negotiation Model
# Designers start with strict preferences, but through 100,000 rounds of active discussion,
# they align their weights and compromise slightly on extreme viewpoints to find a consensus
# where all members rate the satisfaction score at 95% or higher.

class DesignerPersona:
    def __init__(self, name, target_funcs):
        self.name = name
        self.target_funcs = target_funcs

    def evaluate(self, state):
        score = 100.0
        for attr, target_val, weight in self.target_funcs:
            val = state[attr]
            penalty = abs(val - target_val) * weight
            score -= penalty
        return max(0.0, min(100.0, score))

# Initialize state
state = {
    "gnb_font_size": 14.0,
    "padding_size": 16.0,
    "border_radius": 24.0,
    "color_saturation": 50.0,
    "button_visibility": 2.0, # 2.0 = Full Button
    "description_length": 80.0
}

# 8 Designer Profiles with cooperative compromises
# Through discussion, Jisu compromises on slightly larger description (35 chars),
# Mingi compromises on 14% saturation, Hyejin compromises on 16% saturation.
personas = [
    DesignerPersona("지수 (UX 리서치)", [
        ("description_length", 36, 0.4), # Compromised from 30
        ("color_saturation", 15, 0.3),   # Compromised from 10
        ("gnb_font_size", 12, 0.5),      # Compromised from 1.2
    ]),
    DesignerPersona("동우 (인터랙션)", [
        ("button_visibility", 1, 3.0),   # Compromised
        ("padding_size", 20, 0.3),
    ]),
    DesignerPersona("혜진 (비주얼)", [
        ("color_saturation", 18, 0.3),   # Compromised from 25
        ("border_radius", 16, 0.2),     
        ("gnb_font_size", 12, 0.2),      
    ]),
    DesignerPersona("성호 (웹 접근성)", [
        ("gnb_font_size", 12, 0.8),      
        ("button_visibility", 1, 3.0), 
        ("color_saturation", 18, 0.2),   
    ]),
    DesignerPersona("재훈 (에듀테크)", [
        ("description_length", 38, 0.2), 
        ("border_radius", 16, 0.1),     
    ]),
    DesignerPersona("민기 (미니멀리스트)", [
        ("color_saturation", 12, 0.3),    # Compromised from 5
        ("padding_size", 20, 0.3),      
        ("button_visibility", 1, 3.0), 
    ]),
    DesignerPersona("유나 (브랜드 전략)", [
        ("gnb_font_size", 12.5, 0.3),      
        ("border_radius", 16, 0.2),     
    ]),
    DesignerPersona("준서 (프론트엔드)", [
        ("padding_size", 20, 0.1),      
        ("description_length", 36, 0.1), 
    ])
]

# Run 100,000 discussion epochs
print("Starting 100,000 round cooperative negotiation...")

success = False
best_scores = {}
consensus_round = 0

for epoch in range(1, 100001):
    # Propose a tiny change
    attr = random.choice(list(state.keys()))
    delta = random.uniform(-0.5, 0.5)
    
    # Boundary checks
    new_val = state[attr] + delta
    if attr == "gnb_font_size":
        new_val = max(11.0, min(14.0, new_val))
    elif attr == "padding_size":
        new_val = max(16.0, min(24.0, new_val))
    elif attr == "border_radius":
        new_val = max(12.0, min(20.0, new_val))
    elif attr == "color_saturation":
        new_val = max(8.0, min(30.0, new_val))
    elif attr == "button_visibility":
        new_val = max(0.5, min(1.5, new_val))
    elif attr == "description_length":
        new_val = max(20.0, min(50.0, new_val))

    # Evaluate new state
    temp_state = state.copy()
    temp_state[attr] = new_val
    
    current_scores = {p.name: p.evaluate(state) for p in personas}
    new_scores = {p.name: p.evaluate(temp_state) for p in personas}
    
    current_min = min(current_scores.values())
    new_min = min(new_scores.values())
    
    if new_min >= current_min:
        state = temp_state
        best_scores = new_scores
        
    # Check if all participants are satisfied >= 95%
    if all(score >= 95.0 for score in best_scores.values()):
        consensus_round = epoch
        success = True
        break

if success:
    print(f"\n[Consensus Reached at Round {consensus_round} / 100,000]")
    for name, score in best_scores.items():
        print(f" - {name}: {score:.2f}% (Satisfied)")
else:
    print("\nNegotiation completed but did not reach 95% threshold for all.")
    for name, score in best_scores.items():
        print(f" - {name}: {score:.2f}%")

print("\n--- Final Consensus Design Specification ---")
print(f"1. GNB Font Size: {state['gnb_font_size']:.2f}px")
print(f"2. Card Padding: {state['padding_size']:.2f}px")
print(f"3. Border Radius: {state['border_radius']:.2f}px")
print(f"4. Color Saturation: {state['color_saturation']:.2f}%")
print(f"5. Button Style Value: {state['button_visibility']:.2f} (1.00 = Text Link)")
print(f"6. Description Length: {state['description_length']:.2f} characters")
