import { vi } from 'vitest'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

// Let React know that we'll be testing effectful components
global.IS_REACT_ACT_ENVIRONMENT = true

// Mock scheduler to test React features
vi.mock('scheduler', () => require('scheduler/unstable_mock'))

// Silence react-dom & react-dom/client mismatch
const logError = global.console.error.bind(global.console.error)
global.console.error = (...args: any[]) => !args[0].startsWith('Warning') && logError(...args)
