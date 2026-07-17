import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { MessageList } from './MessageList'

it('renders assistant Markdown without unsafe HTML or URLs', () => {
  const { container } = render(
    <MessageList
      tools={[]}
      messages={[
        {
          id: 'assistant:1',
          role: 'assistant',
          content:
            '[Documentation](https://example.com) [unsafe](javascript:alert(1)) <img src=x onerror=alert(1)>'
        }
      ]}
    />
  )

  const link = screen.getByRole('link', { name: 'Documentation' })
  expect(link).toHaveAttribute('href', 'https://example.com')
  expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  expect(container.querySelector('img')).toBeNull()
  expect(screen.queryByRole('link', { name: 'unsafe' })).not.toBeInTheDocument()
})
