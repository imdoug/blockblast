export const COLORS = {
  // Grid & background
  background:   '#0F0C29',
  gridBg:       'rgba(255,255,255,0.05)',
  cellEmpty:    'rgba(255,255,255,0.04)',

  // Piece colors (8 options, indices 0-7)
  pieces: [
    { fill: '#FF6B6B', shadow: '#C0392B', highlight: '#FF9A9A' },
    { fill: '#4ECDC4', shadow: '#2C9E96', highlight: '#7EDDD7' },
    { fill: '#FFE66D', shadow: '#D4AC0D', highlight: '#FFF0A0' },
    { fill: '#A8E6CF', shadow: '#52B788', highlight: '#C8F0DE' },
    { fill: '#FF8B94', shadow: '#C0392B', highlight: '#FFAAB2' },
    { fill: '#6C5CE7', shadow: '#4A3AB5', highlight: '#9D8FF0' },
    { fill: '#FD9644', shadow: '#D35400', highlight: '#FDBA7E' },
    { fill: '#54A0FF', shadow: '#2980B9', highlight: '#85C1FF' },
  ],

  // UI
  primary:  '#4ECDC4',
  accent:   '#FFE66D',
  danger:   '#FF6B6B',
  text:     '#FFFFFF',
  textDim:  'rgba(255,255,255,0.5)',
};

export const SIZES = {
  cell:    44,
  cellGap:  4,
  radius:  10,
};

// ← Add these two lines
export const CELL_SIZE = SIZES.cell;
export const CELL_GAP  = SIZES.cellGap;

export const FONTS = {
  display: 'Fredoka One',
  body:    'Nunito',
};