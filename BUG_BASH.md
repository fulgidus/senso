# Bug Bash - April 10 2026

## Issues (from user report)

1. [x] **Mobile single-line inputs**: No visible submit button; Android "next" key doesn't submit
2. [x] **Recovery phrase grid**: Should be 3 columns on mobile for legibility  
3. [x] **Recovery phrase description**: Should say "recover your personal data", not just messages
4. [x] **Post-signup redirect**: login#destination-address should be ignored; always land on / after signup
5. [ ] **Admin username enforcement**: If admin && no username → must set one up (even during normal ops)
6. [x] **Questionnaire: remove quick mode** (comment out, keep code)
7. [x] **Questionnaire: currency before income** (swap step 1 and 2)
8. [ ] **Bottom toast covers UI** - reduce/fix z-index/position
9. [x] **Pull-to-refresh broken in chat** - desktop scroll broken too; don't intercept scroll events, detect exposure of hidden div
10. [ ] **STT/STS broken** - no errors, just not working
11. [x] **Microphone permission timing** - asks on mic button press, should ask on voice mode enter
12. [ ] **Enriched coach messages not rendering** (content_cards, resource_cards)  
13. [x] **About page missing from menus** (both desktop & mobile nav)
14. [x] **Deep about page** at /about/deep - technical details, no auth required
15. [ ] **Goals/habits/avoid → move to profile** with sealed/unsealed data subsections
16. [ ] **Most screens go into error** - need to investigate root causes
