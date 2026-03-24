type AppConfig = {
  api: {
    backendUrl: string
  }
}

function getBackendUrlFromGlobalConfig(): string | undefined {
  const maybeConfig = (globalThis as { __SENSO_CONFIG__?: AppConfig }).__SENSO_CONFIG__
  return maybeConfig?.api.backendUrl
}

export function getBackendBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_BACKEND_URL
  const fromRuntime = getBackendUrlFromGlobalConfig()
  const value = fromEnv ?? fromRuntime

  if (!value) {
    throw new Error(
      "Missing backend URL. Set VITE_BACKEND_URL from root config.json api.backendUrl",
    )
  }

  return value.replace(/\/$/, "")
}
