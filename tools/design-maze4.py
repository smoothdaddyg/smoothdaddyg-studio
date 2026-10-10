#!/usr/bin/env python3
"""Small simple maze: 13x13, 1-block-thick walls, 3-wide corridors,
3x3 grid (9 intersections). No big open areas, very easy to navigate."""
COLS, ROWS = 13, 13

# Start all walls, carve 3-wide corridors.
grid = [['#' for _ in range(COLS)] for _ in range(ROWS)]

# Corridor bands (3 wide/tall)
BANDS = [(1,3), (5,7), (9,11)]

# Horizontal corridors
for (r1,r2) in [(1,3),(5,7),(9,11)]:
    for r in range(r1, r2+1):
        for c in range(1, COLS-1):
            grid[r][c] = '.'

# Vertical corridors
for (c1,c2) in [(1,3),(5,7),(9,11)]:
    for c in range(c1, c2+1):
        for r in range(1, ROWS-1):
            grid[r][c] = '.'

# Monster house at center: GGG row 6 cols 5-7, door --- row 7 cols 5-7
for c in (5,6,7):
    grid[6][c] = 'G'
    grid[7][c] = '-'

# Player start: bottom-middle corridor
grid[10][6] = 'P'

# Power pellets at 4 outer corners
for (r,c) in [(2,2),(2,10),(10,2),(10,10)]:
    grid[r][c] = 'o'

def show(g):
    for row in g:
        print('"' + ''.join(row) + '",')
show(grid)

# verify walls are 1 thick (max run of # is 1, excluding borders)
thick = []
for r in range(1, ROWS-1):
    run = 0
    for c in range(COLS):
        if grid[r][c] == '#': run += 1
        else:
            if run > 1: thick.append((r,run))
            run = 0
    if run > 1: thick.append((r,run))
print("wall runs >1 thick (interior):", thick)

# connectivity
from collections import deque
def walk(r,c):
    if r<0 or r>=ROWS: return False
    c=c%COLS; return grid[r][c] != '#'
pr,pc=10,6; seen=set([(pr,pc)]); dq=deque([(pr,pc)])
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
