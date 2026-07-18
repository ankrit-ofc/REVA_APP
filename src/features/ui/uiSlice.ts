import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export type Theme = 'light' | 'dark'

interface UiState {
  theme: Theme
  /** True after the staff WS gave up reconnecting (repeated 1008 rejections). */
  realtimeDown: boolean
  /** Bumped by the "tap to retry" banner; realtime hooks recreate their socket. */
  realtimeRetryNonce: number
}

// Native has no localStorage; default to light. (Theme persistence via
// AsyncStorage can be added later if needed.)
const initialState: UiState = {
  theme: 'light',
  realtimeDown: false,
  realtimeRetryNonce: 0,
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<Theme>) {
      state.theme = action.payload
    },
    toggleTheme(state) {
      state.theme = state.theme === 'light' ? 'dark' : 'light'
    },
    realtimeFatal(state) {
      state.realtimeDown = true
    },
    realtimeRetry(state) {
      state.realtimeDown = false
      state.realtimeRetryNonce += 1
    },
  },
})

export const { setTheme, toggleTheme, realtimeFatal, realtimeRetry } = uiSlice.actions
export default uiSlice.reducer
