<div dir="rtl">

# دليل DevOps خطوة بخطوة — Sufra Backend على AWS EKS

نشر خدمات `servers/` عبر: **GitHub Actions → ECR → ArgoCD → EKS** (الناقل NATS).

```
push → main ─▶ GitHub Actions ─▶ بناء ودفع 6 صور ─▶ ECR
                    └▶ تحديث وسوم الصور في kustomization (commit)
                              ArgoCD (يراقب الريبو) ─▶ مزامنة ─▶ EKS
```

الملفات المرجعية: [pipeline](../.github/workflows/servers-cicd.yml) · [k8s](../servers/k8s/base/) · [ArgoCD](../servers/argocd/application.yaml)

---

## المتطلبات (أدوات على جهازك)

```bash
aws --version        # AWS CLI v2
eksctl version       # إنشاء EKS
kubectl version --client
helm version
docker --version
```
وحساب AWS بصلاحيات إنشاء EKS / ECR / IAM.

---

## الخطوة 1 — إنشاء عنقود EKS

```bash
eksctl create cluster \
  --name sufra \
  --region eu-central-1 \
  --nodes 2 --node-type t3.medium \
  --with-oidc --managed
```
> ينشئ العنقود + OIDC provider (يلزم للخطوات التالية). تحقق:
```bash
kubectl get nodes
```

---

## الخطوة 2 — تثبيت AWS Load Balancer Controller (لـ Ingress/ALB)

```bash
# سياسة IAM للـ controller
curl -O https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/main/docs/install/iam_policy.json
aws iam create-policy --policy-name AWSLoadBalancerControllerIAMPolicy \
  --policy-document file://iam_policy.json

# حساب خدمة مربوط بالدور (IRSA)
eksctl create iamserviceaccount --cluster sufra --region eu-central-1 \
  --namespace kube-system --name aws-load-balancer-controller \
  --attach-policy-arn arn:aws:iam::<ACCOUNT_ID>:policy/AWSLoadBalancerControllerIAMPolicy \
  --approve

helm repo add eks https://aws.github.io/eks-charts && helm repo update
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system --set clusterName=sufra \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```
> سائق EBS CSI (لأحجام Postgres/الـ StatefulSets) عادةً مفعّل كـ add-on؛ إن لم يكن:
```bash
eksctl create addon --name aws-ebs-csi-driver --cluster sufra --region eu-central-1 --force
```

---

## الخطوة 3 — تثبيت ArgoCD

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# كلمة مرور المدير الأولية:
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d; echo

# الوصول للواجهة محلياً:
kubectl port-forward svc/argocd-server -n argocd 8080:443
# ثم افتح https://localhost:8080  (المستخدم: admin)
```

---

## الخطوة 4 — ربط GitHub Actions بـ AWS عبر OIDC

1. أضف GitHub كموفّر هوية OIDC في IAM (مرّة واحدة):
   - Provider URL: `https://token.actions.githubusercontent.com`
   - Audience: `sts.amazonaws.com`
2. أنشئ دور IAM (`GitHubActionsSufra`) يثق بهذا الموفّر، مقيّداً بريبوك:
   - شرط `sub` مثل: `repo:JAHEZ3/Sufra:ref:refs/heads/main`
3. أرفق للدور صلاحية ECR (push/pull) — مثلاً `AmazonEC2ContainerRegistryPowerUser`.

> هذا يلغي الحاجة لتخزين مفاتيح AWS طويلة الأمد في GitHub.

---

## الخطوة 5 — أسرار ومتغيرات GitHub

Settings → Secrets and variables → Actions:

| الاسم | النوع | القيمة |
|------|------|--------|
| `AWS_ROLE_ARN` | secret | ARN دور الخطوة 4 |
| `AWS_REGION` | secret | `eu-central-1` |
| `AWS_ACCOUNT_ID` | secret | رقم الحساب (12 رقم) |
| `ENABLE_DEPLOY` | variable | `true` (اختياري) |

---

## الخطوة 6 — أسرار التطبيق داخل العنقود

لا تُرفع قيم حقيقية للـ git. الطريقة السريعة (طوّرها لاحقاً إلى Sealed/External Secrets):

```bash
kubectl create namespace sufra
cp servers/k8s/base/secrets.example.yaml /tmp/sufra-secrets.yaml
# عدّل القيم (DB_PASSWORD, JWT_*, AWS_*, OPENAI_API_KEY, ELEVENLABS_API_KEY ...)
kubectl apply -f /tmp/sufra-secrets.yaml
```

> الإنتاج المفضّل: **External Secrets Operator** يسحب من AWS Secrets Manager / SSM.

---

## الخطوة 7 — تعديل القيم الخاصة بك

- [ingress.yaml](../servers/k8s/base/ingress.yaml): غيّر `host` إلى نطاقك، وفعّل `certificate-arn` (ACM).
- في الإنتاج: احذف `postgres.yaml` من [kustomization](../servers/k8s/base/kustomization.yaml) واضبط `DB_HOST` في [configmap](../servers/k8s/base/configmap.yaml) على عنوان RDS.

---

## الخطوة 8 — تفعيل ArgoCD على الريبو

```bash
kubectl apply -f servers/argocd/application.yaml
```
> ينشئ تطبيق `sufra-backend` الذي يراقب `servers/k8s/base` ويزامن تلقائياً (prune + selfHeal + CreateNamespace).

---

## الخطوة 9 — أول إصدار (تشغيل الـ pipeline)

```bash
git checkout main
git pull
# أي تغيير داخل servers/ ثم:
git push
```
ماذا يحدث تلقائياً:
1. **CI** يجمّع الخدمات الستّ.
2. **Build & Push** يبني صورة لكل خدمة ويدفعها إلى ECR (`sha-xxxxxxx` + `latest`).
3. **GitOps** يحدّث وسوم الصور في `kustomization.yaml` ويعمل commit.
4. **ArgoCD** يكتشف الـ commit ويطبّق التغييرات على EKS.

---

## الخطوة 10 — التحقق

```bash
kubectl -n sufra get pods            # كل الخدمات Running
kubectl -n sufra get svc
kubectl -n sufra get ingress         # ADDRESS = رابط الـ ALB العام
argocd app get sufra-backend         # أو من واجهة ArgoCD
```
وجّه نطاقك (DNS) إلى عنوان الـ ALB.

---

## التراجع (Rollback)

- من واجهة ArgoCD: **History → Rollback** إلى مزامنة سابقة.
- أو عبر git: أرجِع وسوم الصور في `kustomization.yaml` إلى الـ commit السابق وادفع.

---

## استكشاف الأخطاء

| العرض | السبب المحتمل | الحل |
|------|----------------|------|
| Pod في `ImagePullBackOff` | الدور/ECR لا يصرّح بالسحب، أو الوسم خاطئ | تحقق من سياسة IAM للعُقد + وسم الصورة في kustomization |
| Pod `CrashLoopBackOff` | متغيرات بيئة/أسرار ناقصة، أو DB غير متاحة | `kubectl -n sufra logs <pod>` وتأكد من `sufra-secrets`/`sufra-config` |
| Ingress بلا ADDRESS | LB Controller غير مثبّت/بلا صلاحية | راجع `kubectl -n kube-system logs deploy/aws-load-balancer-controller` |
| ArgoCD `OutOfSync` ولا يطبّق | المزامنة اليدوية فقط | فعّل auto-sync (مفعّل في الـ Application) أو اضغط Sync |
| الخدمات لا تتصل بـ NATS | nats غير منشور/عنوان خاطئ | `kubectl -n sufra get pods -l app=nats` + `NATS_URL` في configmap |

---

## ملخص الأوامر (مرجع سريع)

```bash
kubectl -n sufra get pods,svc,ingress
kubectl -n sufra logs -f deploy/api-gateway
kubectl -n sufra rollout restart deploy/order-service
argocd app sync sufra-backend
```

</div>
