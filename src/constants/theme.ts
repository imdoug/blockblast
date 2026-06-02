export const COLORS = {
  // Grid & background
  background:   '#03071f',
  gridBg:       'rgba(255,255,255,0.05)',
  cellEmpty:    'rgba(255,255,255,0.04)',

  // Piece colors (8 options, indices 0-7)
  pieces: [
  { fill: '#FC3346', shadow: '#B80F22', highlight: '#FF7785' },
  { fill: '#00DAD6', shadow: '#008F8C', highlight: '#5FFFFB' },
  { fill: '#FDC818', shadow: '#B98500', highlight: '#FFE96A' },
  { fill: '#50F56F', shadow: '#16A83A', highlight: '#9CFFAD' },
  { fill: '#8F34FA', shadow: '#5514B8', highlight: '#B97AFF' },
  { fill: '#FD7F01', shadow: '#B84C00', highlight: '#FFB04D' },
  { fill: '#088EFD', shadow: '#0059B8', highlight: '#66BFFF' },
  { fill: '#FB4297', shadow: '#B81462', highlight: '#FF85BF' },
],

  // UI
  primary:  '#08aff7',
  accent:   '#FFD93D',
  danger:   '#FF385C',
  text:     '#FFFFFF',
  textDim:  'rgba(255,255,255,0.55)',
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