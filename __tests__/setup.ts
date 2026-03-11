import { vi } from 'vitest'

// jsdom does not implement URL.createObjectURL / revokeObjectURL.
// Every test that exercises the queue will rely on these being callable.
Object.defineProperty(URL, 'createObjectURL', {
  writable: true,
  value: vi.fn().mockImplementation(() => `blob:mock-${Math.random()}`),
})

Object.defineProperty(URL, 'revokeObjectURL', {
  writable: true,
  value: vi.fn(),
})
