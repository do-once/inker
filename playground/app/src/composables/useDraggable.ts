import { ref, onUnmounted } from 'vue'

export function useDraggable(initialX = 0, initialY = 0) {
  const x = ref(initialX)
  const y = ref(initialY)
  const isDragging = ref(false)

  let startX = 0
  let startY = 0
  let startLeft = 0
  let startTop = 0

  function onPointerDown(e: PointerEvent) {
    isDragging.value = true
    startX = e.clientX
    startY = e.clientY
    startLeft = x.value
    startTop = y.value
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
  }

  function onPointerMove(e: PointerEvent) {
    if (!isDragging.value) return
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    x.value = Math.max(0, startLeft + dx)
    y.value = Math.max(0, startTop + dy)

    // 限制不超出窗口右下边界（留 100px 最小可见区域）
    x.value = Math.min(x.value, window.innerWidth - 100)
    y.value = Math.min(y.value, window.innerHeight - 100)
  }

  function onPointerUp() {
    isDragging.value = false
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)
  }

  onUnmounted(() => {
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)
  })

  return { x, y, isDragging, onPointerDown }
}
