export type ResultReferenceTaskType = "tutorial" | "experiment"

export type MajorityMaskReference = {
  majority_mask_base64?: string
  collective_mask_base64?: string
  thorax_top?: number
  thorax_bottom?: number
  sample_count?: number
}

export type UserMaskReference = {
  id: string
  label: string
  image_base64: string
}

export type UserMasksReference = {
  insect_id: string
  user_masks: UserMaskReference[]
}

type LoadReferenceOptions = {
  apiBaseUrl: string
  taskType: ResultReferenceTaskType
  imageName: string
  forceRefresh?: boolean
}

const CACHE_VERSION = "v1"
const majorityRequests = new Map<string, Promise<MajorityMaskReference>>()
const userMaskRequests = new Map<string, Promise<UserMasksReference>>()

const getInsectId = (imageName: string) => imageName.replace(/\.[^.]+$/, "")

const getApiPrefix = (taskType: ResultReferenceTaskType) =>
  taskType === "tutorial" ? "/api/tutorial" : "/api"

const getCacheKey = (
  kind: "majority" | "users",
  taskType: ResultReferenceTaskType,
  insectId: string,
) => `result-reference:${CACHE_VERSION}:${taskType}:${insectId}:${kind}`

const readSessionCache = <T>(key: string): T | null => {
  if (typeof window === "undefined") return null

  try {
    const value = window.sessionStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : null
  } catch {
    return null
  }
}

const writeSessionCache = (key: string, value: unknown) => {
  if (typeof window === "undefined") return

  try {
    window.sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    // The in-memory promise cache still avoids duplicate requests if storage is unavailable.
  }
}

const removeSessionCache = (key: string) => {
  if (typeof window === "undefined") return

  try {
    window.sessionStorage.removeItem(key)
  } catch {
    // Ignore storage access failures and continue with a network refresh.
  }
}

export const loadMajorityMaskReference = async ({
  apiBaseUrl,
  taskType,
  imageName,
  forceRefresh = false,
}: LoadReferenceOptions): Promise<MajorityMaskReference> => {
  const insectId = getInsectId(imageName)
  const requestKey = `${apiBaseUrl}:${taskType}:${insectId}:majority`
  const storageKey = getCacheKey("majority", taskType, insectId)

  if (forceRefresh) {
    majorityRequests.delete(requestKey)
    removeSessionCache(storageKey)
  } else {
    const cached = readSessionCache<MajorityMaskReference>(storageKey)
    if (cached?.majority_mask_base64 || cached?.collective_mask_base64) {
      return cached
    }

    const pending = majorityRequests.get(requestKey)
    if (pending) return pending
  }

  const request = (async () => {
    const response = await fetch(
      `${apiBaseUrl}${getApiPrefix(taskType)}/majority_mask?insect_id=${encodeURIComponent(insectId)}`,
    )
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = (await response.json()) as MajorityMaskReference
    if (!data.majority_mask_base64 && !data.collective_mask_base64) {
      throw new Error("Mask is missing")
    }

    writeSessionCache(storageKey, data)
    return data
  })()

  majorityRequests.set(requestKey, request)

  try {
    return await request
  } catch (error) {
    majorityRequests.delete(requestKey)
    throw error
  }
}

export const loadUserMasksReference = async ({
  apiBaseUrl,
  taskType,
  imageName,
  forceRefresh = false,
}: LoadReferenceOptions): Promise<UserMasksReference> => {
  const insectId = getInsectId(imageName)
  const requestKey = `${apiBaseUrl}:${taskType}:${insectId}:users`
  const storageKey = getCacheKey("users", taskType, insectId)

  if (forceRefresh) {
    userMaskRequests.delete(requestKey)
    removeSessionCache(storageKey)
  } else {
    const cached = readSessionCache<UserMasksReference>(storageKey)
    if (cached && Array.isArray(cached.user_masks)) return cached

    const pending = userMaskRequests.get(requestKey)
    if (pending) return pending
  }

  const request = (async () => {
    const response = await fetch(
      `${apiBaseUrl}${getApiPrefix(taskType)}/user_masks?insect_id=${encodeURIComponent(insectId)}`,
    )
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = (await response.json()) as UserMasksReference
    if (!Array.isArray(data.user_masks)) throw new Error("User masks are missing")

    writeSessionCache(storageKey, data)
    return data
  })()

  userMaskRequests.set(requestKey, request)

  try {
    return await request
  } catch (error) {
    userMaskRequests.delete(requestKey)
    throw error
  }
}

export const prefetchResultReferenceData = async (
  options: Omit<LoadReferenceOptions, "forceRefresh">,
) => {
  await Promise.allSettled([
    loadMajorityMaskReference(options),
    loadUserMasksReference(options),
  ])
}
