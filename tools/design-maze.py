#!/usr/bin/env python3
"""Design a tall portrait maze for Miss Munch: fills a phone screen,
every pathway 1 tile wide with walls on both sides (no open rooms)."""
COLS, ROWS = 13, 28

# Horizontal corridors (full width, cols 1-11)
H_ROWS = [1, 7, 13, 19, 25]
# Vertical corridors (cols)
V_COLS = [1, 6, 11]

grid = []
for r in range(ROWS):
    row = []
    for c in range(COLS):
        if r == 0 or r == ROWS - 1 or c == 0 or c == COLS - 1:
            row.append('#')
        elif r in H_ROWS:
            row.append('.')
        elif c in V_COLS:
            row.append('.')
        else:
            row.append('#')
    grid.append(row)

# Monster house: center it on the middle horizontal corridor (row 13).
# House interior (GGG) at row 12, cols 5-7; door (---) at row 13, cols 5-7.
for c in (5, 6, 7):
    grid[12][c] = 'G'
    grid[13][c] = '-'

# Player start on the bottom corridor
grid[25][6] = 'P'

# Power pellets at the four corridor ends
for (r, c) in [(1, 1), (1, 11), (25, 1), (25, 11)]:
    grid[r][c] = 'o'

def show(g):
    for row in g:
        print('"' + ''.join(row) + '",')

show(grid)

# --- verify: no open areas larger than a 1-wide corridor ---
# A "big open area" = any 2x2 block of non-wall tiles (excluding house/door).
bad = []
for r in range(ROWS - 1):
    for c in range(COLS - 1):
        cells = [grid[r][c], grid[r+1][c], grid[r][c+1], grid[r+1][c+1]]
        # house/door tiles are allowed to be adjacent
        if all(ch != '#' for ch in cells):
            # allow if it's part of the house (G or -)
            if not any(ch in 'G-' for ch in cells):
                bad.append((r, c))
print("2x2 open blocks (should be none):", bad)

# --- verify: all dots reachable from P ---
from collections import deque
def walkable(r, c):
    if r < 0 or r >= ROWS: return False
    c = c % COLS
    return grid[r][c] != '#'

pr, pc = 25, 6
seen = set([(pr, pc)])
dq = deque([(pr, pc)])
while dq:
    r, c = dq.popleft()
    for dr, dc in ((1,0),(-1,0),(0,1),(0,-1)):
        nr, nc = r+dr, (c+dc) % COLS
        if 0 <= nr < ROWS and (nr, nc) not in seen and walkable(nr, nc):
            # player can't go through house
            if grid[nr][nc] in 'G-': continue
            seen.add((nr, nc)); dq.append((nr, nc))

unreach = 0
dots = 0
for r in range(ROWS):
    for c in range(COLS):
        if grid[r][c] in '.oP':
            dots += 1
            if (r, c) not in seen: unreach += 1
print(f"dots: {dots}, unreachable: {unreach}")

# --- verify: house has walls around except door ---
print("house row12:", ''.join(grid[12][4:9]), "door row13:", ''.join(grid[13][4:9]))
