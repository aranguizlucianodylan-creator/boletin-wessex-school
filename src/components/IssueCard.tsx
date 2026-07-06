import { Link } from 'react-router-dom'
import type { Issue } from '../types/issue'
import { formatIssueDate } from '../utils/issues'
import { withBasePath } from '../utils/paths'

interface IssueCardProps {
  issue: Issue
}

export const IssueCard = ({ issue }: IssueCardProps) => {
  const coverSrc = withBasePath(issue.coverUrl || '/images/placeholder-cover.svg')

  return (
    <article className="issue-card">
      <div className="issue-card__cover">
        <img src={coverSrc} alt={`Portada de ${issue.title}`} />
      </div>
      <div className="issue-card__content">
        <p className="issue-card__meta">
          {issue.month} {issue.year}
        </p>
        <h3>{issue.title}</h3>
        <p>{issue.description}</p>
        <div className="issue-card__footer">
          <span>{formatIssueDate(issue.publishedAt)}</span>
          <Link to={`/revista/${issue.slug}`} className="button button-secondary">
            Abrir revista
          </Link>
        </div>
      </div>
    </article>
  )
}
