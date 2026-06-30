import type { RouteRecordRaw } from 'vue-router'

export const imageWorkbenchRoutes: RouteRecordRaw[] = [
  {
    path: '/image2',
    alias: '/image-studio',
    name: 'ImageWorkbench',
    component: () => import('./ImageWorkbenchView.vue'),
    meta: {
      requiresAuth: true,
      requiresAdmin: false,
      title: 'Image Workbench',
      titleKey: 'imageWorkbench.title',
      descriptionKey: 'imageWorkbench.description',
    },
  },
]

export default imageWorkbenchRoutes
