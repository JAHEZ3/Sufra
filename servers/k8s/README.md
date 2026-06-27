# Sufra Backend — CI/CD & Deployment (GitHub Actions → ECR → ArgoCD → EKS)

GitOps pipeline for the NestJS microservices in `servers/`.

```
push to main ─▶ GitHub Actions ─▶ build & push images ─▶ ECR
                     │
                     └─▶ bump image tags in k8s/base/kustomization.yaml (commit)
                                          │
                              ArgoCD (watches repo) ─▶ syncs ─▶ EKS
```

## Components

| Layer | Tool | File(s) |
|-------|------|---------|
| CI / build / push | GitHub Actions | `.github/workflows/servers-cicd.yml` |
| Image registry | AWS ECR | (created automatically per service) |
| GitOps deploy | ArgoCD | `servers/argocd/application.yaml` |
| Cluster | AWS EKS | `servers/k8s/base/*` (kustomize) |
| Broker | NATS | `servers/k8s/base/nats.yaml` |
| Cache | Redis | `servers/k8s/base/redis.yaml` |
| Database | Postgres (dev) / RDS (prod) | `servers/k8s/base/postgres.yaml` |

## One-time setup

1. **GitHub repo secrets** (Settings → Secrets → Actions):
   - `AWS_ROLE_ARN` — IAM role assumable via GitHub OIDC, with ECR push/pull.
   - `AWS_REGION` — e.g. `eu-central-1`.
   - `AWS_ACCOUNT_ID` — 12-digit account id.
2. **EKS cluster** with the AWS Load Balancer Controller (for the ALB Ingress)
   and an EBS CSI driver (for the StatefulSet volumes).
3. **Install ArgoCD** on the cluster, then:
   ```bash
   kubectl apply -f servers/argocd/application.yaml
   ```
4. **Secrets** — never commit real values. Create the `sufra-secrets` Secret via
   Sealed Secrets / External Secrets Operator (recommended) or, for a quick
   start, fill `secrets.example.yaml` and `kubectl apply` it once.

## Local validation

```bash
kustomize build servers/k8s/base | kubectl apply --dry-run=client -f -
```

## Notes

- **Broker:** services use **NATS** (`Transport.NATS`); it's deployed via
  `nats.yaml` and wired through `NATS_URL` in the ConfigMap.
- **Postgres:** the in-cluster StatefulSet is for dev/staging. In production use
  **RDS** — remove `postgres.yaml` from `kustomization.yaml` and point `DB_HOST`
  (ConfigMap) at the RDS endpoint.
- **Frontends** (`client`, `dashboard`, `paneldashboard`) are not part of this
  backend pipeline — deploy them to Vercel/Amplify or add their own workflow.
