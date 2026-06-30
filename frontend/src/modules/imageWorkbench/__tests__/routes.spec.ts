import { describe, expect, it } from 'vitest'
import { imageWorkbenchRoutes } from '../routes'

describe('imageWorkbenchRoutes', () => {
  it('keeps the image studio as an isolated user module with a compatible alias', () => {
    expect(imageWorkbenchRoutes).toHaveLength(1)
    expect(imageWorkbenchRoutes[0]).toMatchObject({
      path: '/image2',
      alias: '/image-studio',
      name: 'ImageWorkbench',
      meta: {
        requiresAuth: true,
        requiresAdmin: false,
        titleKey: 'imageWorkbench.title',
        descriptionKey: 'imageWorkbench.description',
      },
    })
  })
})
