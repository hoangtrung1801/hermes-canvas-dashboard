import type { ToolActivity as ToolActivityModel } from './chat.types'

export function ToolActivity({ activity }: { activity: ToolActivityModel }) {
  return (
    <li className={`chat-tool chat-tool-${activity.status}`}>
      <span className="chat-tool-icon" aria-hidden="true">
        {activity.status === 'running' ? <SpinnerIcon /> : <ResultIcon failed={activity.status === 'failed'} />}
      </span>
      <span className="chat-tool-copy">
        <span className="chat-tool-summary">{activity.summary}</span>
        <span className="chat-tool-name">{activity.name.replaceAll('_', ' ')}</span>
      </span>
      <span className="hermes-sr-only">
        {activity.status === 'running'
          ? 'In progress'
          : activity.status === 'completed'
            ? 'Completed'
            : 'Failed'}
      </span>
    </li>
  )
}

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="7" />
      <path d="M10 3a7 7 0 0 1 7 7" />
    </svg>
  )
}

function ResultIcon({ failed }: { failed: boolean }) {
  return failed ? (
    <svg viewBox="0 0 20 20">
      <path d="m6 6 8 8M14 6l-8 8" />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20">
      <path d="m5 10 3 3 7-7" />
    </svg>
  )
}
