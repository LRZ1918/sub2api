import { apiClient } from '../client'

export type LaunchReadinessStatus = 'pass' | 'warn' | 'fail'
export type LaunchReadinessOverallStatus = 'blocked' | 'internal_test_ready' | 'launch_ready'

export interface LaunchReadinessCheck {
  id: string
  title: string
  description: string
  status: LaunchReadinessStatus
  value?: string
  action_label?: string
  action_path?: string
}

export interface LaunchReadinessSection {
  id: string
  title: string
  status: LaunchReadinessStatus
  completed: number
  total: number
  checks: LaunchReadinessCheck[]
}

export interface LaunchReadinessReport {
  overall_status: LaunchReadinessOverallStatus
  completed: number
  total: number
  sections: LaunchReadinessSection[]
  generated_at: string
}

export async function getLaunchReadiness(): Promise<LaunchReadinessReport> {
  const { data } = await apiClient.get<LaunchReadinessReport>('/admin/launch-readiness')
  return data
}

export const launchReadinessAPI = {
  getLaunchReadiness
}

export default launchReadinessAPI
