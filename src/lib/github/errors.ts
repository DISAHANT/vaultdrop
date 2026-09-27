/**
 * Structured GitHub Integration Error System for VaultDrop
 * Provides user-friendly explanations, technical details, and actionable remediation steps.
 */

export interface GitHubErrorInfo {
  step?: string;
  statusCode: number;
  errorCode: string;
  reason: string;
  suggestedFix: string;
  technicalDetails?: string;
  requestId?: string;
  retryable: boolean;
}

export class GitHubApiError extends Error {
  public readonly info: GitHubErrorInfo;

  constructor(info: GitHubErrorInfo) {
    super(info.reason);
    this.name = 'GitHubApiError';
    this.info = info;
  }
}

/**
 * Parses any GitHub API response or thrown error into a standardized GitHubErrorInfo
 */
export function parseGitHubError(err: any, step: string = 'GitHub Operation'): GitHubErrorInfo {
  const status = err?.status || err?.statusCode || (typeof err?.code === 'number' ? err.code : 500);
  const requestId = err?.headers?.['x-github-request-id'] || err?.requestId || undefined;
  const rawMessage = err?.message || err?.toString() || 'Unknown error occurred';

  // 401 Unauthorized / Bad Credentials
  if (status === 401) {
    return {
      step,
      statusCode: 401,
      errorCode: 'UNAUTHORIZED',
      reason: 'GitHub authentication expired or credentials are no longer valid.',
      suggestedFix: 'Please disconnect and reconnect your GitHub account to refresh authorization.',
      technicalDetails: `HTTP 401: ${rawMessage}`,
      requestId,
      retryable: false,
    };
  }

  // 403 Forbidden / Permissions / Rate Limit
  if (status === 403) {
    const isRateLimit = rawMessage.toLowerCase().includes('rate limit') || rawMessage.toLowerCase().includes('secondary rate');
    if (isRateLimit) {
      return {
        step,
        statusCode: 403,
        errorCode: 'RATE_LIMITED',
        reason: 'GitHub API rate limit exceeded.',
        suggestedFix: 'Please wait a couple of minutes before retrying your operation.',
        technicalDetails: `HTTP 403 Rate Limit: ${rawMessage}`,
        requestId,
        retryable: true,
      };
    }

    return {
      step,
      statusCode: 403,
      errorCode: 'FORBIDDEN',
      reason: 'The GitHub App does not have write access to this repository.',
      suggestedFix: 'Install VAULTDROP SYNC on this repository with Contents: Read & Write permission.',
      technicalDetails: `HTTP 403: ${rawMessage}`,
      requestId,
      retryable: false,
    };
  }

  // 404 Not Found
  if (status === 404) {
    return {
      step,
      statusCode: 404,
      errorCode: 'NOT_FOUND',
      reason: 'Repository or branch not found, or VAULTDROP SYNC does not have access.',
      suggestedFix: 'Ensure the repository exists and check that VAULTDROP SYNC is granted access in your GitHub App installation settings.',
      technicalDetails: `HTTP 404: ${rawMessage}`,
      requestId,
      retryable: false,
    };
  }

  // 409 Conflict
  if (status === 409) {
    return {
      step,
      statusCode: 409,
      errorCode: 'CONFLICT',
      reason: 'Repository state conflict. The remote branch has new commits since your last sync.',
      suggestedFix: 'Review conflicting files or pull latest changes before committing.',
      technicalDetails: `HTTP 409 Conflict: ${rawMessage}`,
      requestId,
      retryable: false,
    };
  }

  // 422 Unprocessable Entity
  if (status === 422) {
    return {
      step,
      statusCode: 422,
      errorCode: 'VALIDATION_ERROR',
      reason: 'GitHub rejected the commit payload or Git tree structure.',
      suggestedFix: 'Verify the commit message and file structure, then try again.',
      technicalDetails: `HTTP 422: ${rawMessage}`,
      requestId,
      retryable: false,
    };
  }

  // 429 Too Many Requests
  if (status === 429) {
    return {
      step,
      statusCode: 429,
      errorCode: 'TOO_MANY_REQUESTS',
      reason: 'Too many requests sent to GitHub API.',
      suggestedFix: 'Please wait 60 seconds before retrying.',
      technicalDetails: `HTTP 429: ${rawMessage}`,
      requestId,
      retryable: true,
    };
  }

  // Network / Fetch timeout
  if (err?.name === 'AbortError' || rawMessage.includes('timeout') || rawMessage.includes('ECONNREFUSED')) {
    return {
      step,
      statusCode: 504,
      errorCode: 'NETWORK_TIMEOUT',
      reason: 'Network timeout while communicating with GitHub API.',
      suggestedFix: 'Check your internet connection or GitHub status page, then retry.',
      technicalDetails: rawMessage,
      retryable: true,
    };
  }

  // 500+ GitHub / Server Error
  return {
    step,
    statusCode: status >= 500 ? status : 500,
    errorCode: 'SERVER_ERROR',
    reason: 'An error occurred during communication with GitHub.',
    suggestedFix: 'Retry the operation. If the issue persists, check your repository settings.',
    technicalDetails: `Status ${status}: ${rawMessage}`,
    requestId,
    retryable: true,
  };
}
