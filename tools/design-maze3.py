#!/usr/bin/env python3
"""Simple thin-wall maze: 1-block-thick walls, 2-wide corridors,
simple ladder/grid pattern, fills 13x28 portrait screen."""
COLS, ROWS = 13, 28

# Start all walls, carve corridors.
grid = [['#' for _ in range(COLS)] for _ in range(ROWS)]

# Horizontal corridors (2 tall): rows (1,2), (4,5), (7,8), (10,11), (13,14),
# (16,17), (19,20), (22,23), (25,26) — cols 1-11
H = [(1,2),(4,5),(7,8),(10,11),(13,14),(16,17),(19,20),(22,23),(25,26)]
for (r1,r2) in H:
    for c in range(1, COLS-1):
        grid[r1][c] = '.'
        grid[r2][c] = '.'

# Vertical corridors (2 wide): cols (1,2), (5,6), (9,10) — rows 1-26
V = [(1,2),(5,6),(9,10)]
for (c1,c2) in V:
    for r in range(1, ROWS-1):
        grid[r][c1] = '.'
        grid[r][c2] = '.'

# Monster house: use the middle horizontal corridor (rows 13-14).
# House interior GGG at row 13, cols 5-7; door --- at row 14, cols 5-7.
for c in (5,6,7):
    grid[13][c] = 'G'
    grid[14][c] = '-'

# Player start on bottom corridor
grid[25][6] = 'P'
grid[26][6] = 'P'  # 2-tall corridor, mark both? just one P
grid[26][6] = '.'

# Power pellets at four corners
for (r,c) in [(1,1),(1,10),(25,1),(25,10)]:
    grid[r][c] = 'o'

def show(g):
    for row in g:
        print('"' + ''.join(row) + '",')
show(grid)

# verify: walls are 1 thick? check max wall-run length
# (allow borders and the areas outside corridors)
# verify no 2x2 open is impossible with 2-wide corridors; instead check
# that no open area exceeds 3x3
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

# check wall thickness: find horizontal wall runs > 1
thick = []
for r in range(ROWS):
    run = 0
    for c in range(COLS+1):
        ch = grid[r][c] if c < COLS else '#'
        if ch == '#': run += 1
        else:
            if run > 1: thick.append((r, run))
            run = 0
# filter out border rows (0 and 27) which are all walls
thick = [(r,n) for (r,n) in thick if r not in (0, ROWS-1)]
print("wall runs >1 thick (non-border):", thick[:10], "... total", len(thick))
