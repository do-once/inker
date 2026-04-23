<script setup lang="ts">
defineProps<{
  isPlaying: boolean
  isPaused: boolean
  progress: number
  speed: number
}>()

const emit = defineEmits<{
  play: []
  pause: []
  stop: []
  setSpeed: [speed: number]
}>()

const speeds = [0.5, 1, 2]

function formatProgress(p: number): string {
  return Math.round(p * 100) + '%'
}
</script>

<template>
  <div class="playback-section">
    <div class="progress-bar">
      <div class="progress-track">
        <div class="progress-fill" :style="{ width: formatProgress(progress) }" />
      </div>
      <span class="progress-text">{{ formatProgress(progress) }}</span>
    </div>
    <div class="playback-controls">
      <button
        v-if="!isPlaying && !isPaused"
        class="action-btn"
        @click="emit('play')"
      >
        播放
      </button>
      <button
        v-if="isPlaying"
        class="action-btn"
        @click="emit('pause')"
      >
        暂停
      </button>
      <button
        v-if="isPaused"
        class="action-btn"
        @click="emit('pause')"
      >
        继续
      </button>
      <button
        v-if="isPlaying || isPaused"
        class="action-btn danger"
        @click="emit('stop')"
      >
        停止
      </button>
    </div>
    <div class="speed-row">
      <span class="speed-label">速度</span>
      <button
        v-for="s in speeds"
        :key="s"
        :class="['speed-btn', { active: speed === s }]"
        @click="emit('setSpeed', s)"
      >
        {{ s }}x
      </button>
    </div>
  </div>
</template>

<style scoped>
.playback-section {
}
.progress-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.progress-track {
  flex: 1;
  height: 4px;
  background: #e0e0e0;
  border-radius: 2px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: #333;
  border-radius: 2px;
  transition: width 0.1s;
}
.progress-text {
  font-size: 11px;
  color: #999;
  min-width: 32px;
  text-align: right;
}
.playback-controls {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
}
.action-btn {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #fff;
  color: #333;
  cursor: pointer;
  font-size: 13px;
  text-align: center;
  transition: all 0.15s;
}
.action-btn:hover {
  background: #f5f5f5;
}
.action-btn.danger:hover {
  background: #fee;
  border-color: #fcc;
  color: #c33;
}
.speed-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.speed-label {
  font-size: 12px;
  color: #999;
  margin-right: 4px;
}
.speed-btn {
  padding: 4px 8px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: #fff;
  color: #333;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.15s;
}
.speed-btn:hover {
  background: #f5f5f5;
}
.speed-btn.active {
  background: #333;
  color: #fff;
  border-color: #333;
}
</style>
