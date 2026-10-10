#!/usr/bin/env python3
"""Simple maze: 1-block-thick walls, small rooms (no big open areas),
fills a portrait phone screen. Very simple topology."""
COLS, ROWS = 13, 28

# Start with all open (dots), then draw 1-thick walls.
grid = [['.' for _ in range(COLS)] for _ in range(ROWS)]

# Border
for c in range(COLS):
    grid[0][c] = '#'; grid[ROWS-1][c] = '#'
for r in range(ROWS):
    grid[r][0] = '#'; grid[r][COLS-1] = '#'

# Vertical 1-thick walls at cols 4 and 8, with 2-wide doorways
for r in range(1, ROWS-1):
    # doorways at rows 3-4, 11-12, 19-20, 26-27 (gaps in the walls)
    if r in (3,4, 11,12, 19,20, 26,27):
        continue
    grid[r][4] = '#'; grid[r][8] = '#'

# Horizontal 1-thick walls at rows 7, 14, 21, with 2-wide doorways
for c in range(1, COLS-1):
    # doorways at cols 2-3, 6-7, 10-11
    if c in (2,3, 6,7, 10,11):
        continue
    grid[7][c] = '#'; grid[14][c] = '#'; grid[21][c] = '#'

# Monster house: center room. Put GGG at row 13, cols 5-7; door below at row 14.
# Row 14 is a horizontal wall — replace part with door.
for c in (5,6,7):
    grid[13][c] = 'G'
for c in (5,6,7):
    grid[14][c] = '-'
# Ensure the wall segments around the door remain
# (row 14 already has # except doorways; we override 5-7 with door)

# Player start: bottom area
grid[25][6] = 'P'

# Power pellets at corners
for (r,c) in [(1,1),(1,11),(26,1),(26,11)]:
    if grid[r][c] == '.': grid[r][c] = 'o'

def show(g):
    for row in g:
        print('"' + ''.join(row) + '",')
show(grid)

# verify no 2x2 open (excluding house/door)
bad = []
for r in range(ROWS-1):
    for c in range(COLS-1):
        cells = [grid[r][c], grid[r+1][c], grid[r][c+1], grid[r+1][c+1]]
        if all(ch != '#' for ch in cells) and not any(ch in 'G-' for ch in cells):
            bad.append((r,c))
print("2x2 open blocks:", len(bad), "(rooms are 3x6, bounded by 1-thick walls)")

# connectivity from P
from collections import deque
def walk(r,c):
    if r<0 or r>=ROWS: return False
    c=c%COLS; return grid[r][c] != '#'
pr,pc=25,6; seen=set([(pr,pc)]); dq=deque([(pr,pc)])
while dq:
    r,c=dq.popleft()
    for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)):
        nr,nc=r+dr,(c+dc)%COLS
        if 0<=nr<ROWS and (nr,nc) not in seen and walk(nr,nc) and grid[nr][nc] not in 'G-':
            seen.add((nr,nc)); dq.append((nr,nc))
unreach=dots=0
for r in range(ROWS):
    for c in range(COLS):
        if grid[r][c] in '.oP': dots+=1
        if grid[r][c] in '.oP' and (r,c) not in seen: unreach+=1
print(f"dots: {dots}, unreachable: {unreach}")
