// Isolated, non-persistent preview. Does not load the app, accounts or shared-group code.
const board = document.getElementById('demo-board');
const blocks = [...board.querySelectorAll('[data-draggable]')];
let drag = null;

function position(block, x, y) {
  const width = board.clientWidth, height = board.clientHeight;
  const left = Math.max(0, Math.min(width - block.offsetWidth, x));
  const top = Math.max(22, Math.min(height - block.offsetHeight - 22, y));
  block.style.left = left / width * 100 + '%';
  block.style.top = top / height * 100 + '%';
}
for (const block of blocks) {
  block.addEventListener('pointerdown', e => {
    if (e.button !== 0 || drag) return;
    e.preventDefault();
    block.focus({ preventScroll: true });
    block.setPointerCapture(e.pointerId);
    drag = { block, id: e.pointerId, x: e.clientX, y: e.clientY, left: block.offsetLeft, top: block.offsetTop };
    block.classList.add('dragging');
  });
  block.addEventListener('pointermove', e => {
    if (!drag || drag.block !== block || drag.id !== e.pointerId) return;
    // The board is slightly rotated visually: convert the pointer delta to its local axes.
    const matrix = new DOMMatrix(getComputedStyle(board.closest('.preview-wrap')).transform);
    const delta = new DOMPoint(e.clientX - drag.x, e.clientY - drag.y).matrixTransform(matrix.inverse());
    position(block, drag.left + delta.x, drag.top + delta.y);
  });
  const end = () => { if (drag?.block === block) { block.classList.remove('dragging'); drag = null; } };
  block.addEventListener('pointerup', end);
  block.addEventListener('pointercancel', end);
  block.addEventListener('lostpointercapture', end);
  block.addEventListener('keydown', e => {
    const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!directions[e.key]) return;
    e.preventDefault();
    const [x, y] = directions[e.key], step = e.shiftKey ? 24 : 8;
    position(block, block.offsetLeft + x * step, block.offsetTop + y * step);
  });
}
document.getElementById('reset-preview').addEventListener('click', () => {
  for (const block of blocks) { block.style.removeProperty('left'); block.style.removeProperty('top'); }
});
