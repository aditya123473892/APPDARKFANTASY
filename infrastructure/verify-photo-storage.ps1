param(
    [Parameter(Mandatory = $true)][string]$Bucket,
    [Parameter(Mandatory = $true)][string]$Region
)
# Read-only. AccessDenied leaves a setting unverified; do not treat it as safe.
aws s3api get-public-access-block --bucket $Bucket --region $Region
aws s3api get-bucket-encryption --bucket $Bucket --region $Region
aws s3api get-bucket-policy --bucket $Bucket --region $Region --query Policy --output text
aws s3api get-bucket-cors --bucket $Bucket --region $Region
aws s3api get-bucket-lifecycle-configuration --bucket $Bucket --region $Region
aws s3api get-bucket-ownership-controls --bucket $Bucket --region $Region
aws s3api get-bucket-versioning --bucket $Bucket --region $Region
aws s3api get-bucket-acl --bucket $Bucket --region $Region
aws s3api get-bucket-policy-status --bucket $Bucket --region $Region
