import { apiClient } from '@/api/client'

export interface ImageWorkbenchKeyOption {
  id: number
  name: string
  masked_key: string
  group_id?: number
  group_name?: string
  group_platform?: string
  subscription_type?: string
  balance?: number
  quota_remaining: number
}

export interface ImageWorkbenchPricingInterval {
  tier_label?: string
  min_tokens: number
  max_tokens?: number | null
  per_request_price?: number | null
}

export interface ImageWorkbenchModelPricing {
  billing_mode: string
  image_output_price?: number | null
  per_request_price?: number | null
  intervals?: ImageWorkbenchPricingInterval[]
}

export interface ImageWorkbenchModelOption {
  name: string
  label?: string
  platform: string
  group_ids?: number[]
  available_key_ids?: number[]
  supported_formats?: string[]
  pricing?: ImageWorkbenchModelPricing | null
}

export interface ImageWorkbenchDefaults {
  model: string
  size: string
  quality: string
  format: string
  count: number
  background: string
  style: string
  sizes: string[]
  qualities: string[]
  formats: string[]
  backgrounds: string[]
  styles: string[]
}

export interface ImageWorkbenchOptions {
  api_keys: ImageWorkbenchKeyOption[]
  models: ImageWorkbenchModelOption[]
  defaults: ImageWorkbenchDefaults
}

export interface ImageGenerationRequest {
  api_key_id: number
  model: string
  prompt: string
  size?: string
  n?: number
  quality?: string
  response_format?: string
  output_format?: string
  background?: string
  style?: string
}

export interface ImageResultItem {
  url?: string
  b64_json?: string
  revised_prompt?: string
}

export interface ImageWorkbenchResult {
  data?: ImageResultItem[]
  created?: number
  [key: string]: unknown
}

export const imageWorkbenchAPI = {
  async getOptions(): Promise<ImageWorkbenchOptions> {
    const response = await apiClient.get<ImageWorkbenchOptions>('/image-workbench/options')
    return response.data
  },

  async generateImage(input: ImageGenerationRequest): Promise<ImageWorkbenchResult> {
    const payload: ImageGenerationRequest = {
      api_key_id: input.api_key_id,
      model: input.model,
      prompt: input.prompt,
      size: input.size,
      n: input.n,
      quality: input.quality,
      response_format: input.response_format,
      output_format: input.output_format,
      background: input.background,
      style: input.style,
    }
    const response = await apiClient.post<ImageWorkbenchResult>('/image-workbench/generations', payload)
    return response.data
  },

  async editImage(formData: FormData): Promise<ImageWorkbenchResult> {
    const response = await apiClient.post<ImageWorkbenchResult>('/image-workbench/edits', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },
}

export const getOptions = imageWorkbenchAPI.getOptions
export const generateImage = imageWorkbenchAPI.generateImage
export const editImage = imageWorkbenchAPI.editImage

export default imageWorkbenchAPI
