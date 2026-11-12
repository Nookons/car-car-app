# Local review and deployment

- Run and review Dashboard changes locally in a real browser before deployment.
- Deploy only after the user explicitly asks to deploy the current changes. A past deployment request does not authorize future deployments.
- Never change database passwords or credentials without the user's explicit approval.
- Local previews connected to the production database must use read-only connections.
