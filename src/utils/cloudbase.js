import cloudbaseSDK from '@cloudbase/js-sdk'

let app = null

export function getApp() {
  if (app) return app
  app = cloudbaseSDK.init({
    env: import.meta.env.VITE_CLOUDBASE_ENV_ID,
  })
  return app
}

export async function ensureLogin() {
  const auth = getApp().auth({ persistence: 'local' })
  const state = await auth.getLoginState()
  if (state) return state
  return auth.anonymousAuthProvider().signIn()
}

export function db() {
  return getApp().database()
}
