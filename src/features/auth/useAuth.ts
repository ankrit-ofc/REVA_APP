import { useSelector } from 'react-redux'
import type { RootState } from '@/store/store'
import { unregisterPush } from '@/features/push/push'
import { useLogoutMutation } from './authApi'

export function useAuth() {
  const auth = useSelector((state: RootState) => state.auth)
  const [logoutMutation, { isLoading: isLoggingOut }] = useLogoutMutation()

  return {
    ...auth,
    isLoggingOut,
    // Deactivate this device's push token BEFORE the session is torn down (while
    // the access token is still valid), so a shared device stops alerting for
    // this user; then perform the normal logout.
    logout: async () => {
      await unregisterPush()
      logoutMutation()
    },
  }
}
