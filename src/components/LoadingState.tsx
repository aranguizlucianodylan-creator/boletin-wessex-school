interface LoadingStateProps {
  message?: string
}

export const LoadingState = ({ message = 'Cargando contenido...' }: LoadingStateProps) => {
  return (
    <div className="loading-card" role="status" aria-live="polite">
      <div className="spinner" />
      <p>{message}</p>
    </div>
  )
}
