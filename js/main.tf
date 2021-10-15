variable "domain_name" {
  description = "The canonical domain name. Both www and non-www are valid."
  type        = string
}

variable "website_bucket" {
  description = "The name of the S3 bucket used as the website endpoint."
  type        = string
}

variable "content_bucket" {
  description = "The name of the S3 bucket used to store the content."
  type        = string
}

variable "logs_bucket" {
  description = "The name of the S3 bucket used to store the CloudFront logs."
  type        = string
}

variable "region" {
  description = "The AWS region of the website bucket and logs bucket."
  type        = string
}

resource "random_id" "user_agent" {
  keepers     = { refresh = 0 }
  byte_length = 32
}

locals {
  tags                 = { project = var.domain_name }
  redirect_domain_name = substr(var.domain_name, 0, 4) == "www." ? substr(var.domain_name, 4, -1) : "www.${var.domain_name}"
  user_agent           = "CloudFront (${random_id.user_agent.b64_std})"
}

provider "aws" {
  region = "us-east-1"
}

provider "aws" {
  alias  = "buckets"
  region = var.region
}

# IAM

resource "aws_iam_role" "gateway_endpoint" {
  name = "gateway_endpoint"

  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Effect": "Allow",
      "Sid": ""
    }
  ]
}
EOF
}

resource "aws_iam_policy" "gateway_endpoint" {
  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": {
    "Effect": "Allow",
    "Action": [
      "apigateway:*",
      "dynamodb:*"
    ],
    "Resource": ["*"]
  }
}
EOF
}

resource "aws_iam_role_policy_attachment" "endpoint_dynamodb_gateway_access" {
  role       = aws_iam_role.gateway_endpoint.name
  policy_arn = aws_iam_policy.gateway_endpoint.arn
}

resource "aws_iam_role_policy_attachment" "authorizer_logging_access" {
  role       = aws_iam_role.gateway_endpoint.name
  policy_arn = aws_iam_policy.logging_policy.arn
}

resource "aws_iam_role" "custom_auth_access_role" {
  name = "custom_auth_access_role"

  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Effect": "Allow",
      "Sid": ""
    }
  ]
}
EOF
}

resource "aws_iam_policy" "logging_policy" {
  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": {
    "Effect": "Allow",
    "Action": [
      "sts:AssumeRole",
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ],
    "Resource": ["*"]
  }
}
EOF
}

resource "aws_iam_policy" "dynamodb_access" {
  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": {
    "Effect": "Allow",
    "Action": [
      "dynamodb:*"
    ],
    "Resource": ["*"]
  }
}
EOF
}

resource "aws_iam_role_policy_attachment" "lambda_policy_attachment" {
  role       = aws_iam_role.custom_auth_access_role.name
  policy_arn = aws_iam_policy.logging_policy.arn
}

resource "aws_iam_role" "cognito_authenticated" {
  name               = "cognito_authenticated"
  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "",
      "Effect": "Allow",
      "Principal": {
        "Federated": "cognito-identity.amazonaws.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "cognito-identity.amazonaws.com:aud": "${aws_cognito_identity_pool.keyther_identities.id}"
        },
        "ForAnyValue:StringLike": {
          "cognito-identity.amazonaws.com:amr": "authenticated"
        }
      }
    }
  ]
}
 EOF
}

resource "aws_iam_role_policy" "web_auth_allow_s3_access" {
  name   = "web_auth_allow_s3_access"
  role   = aws_iam_role.cognito_authenticated.id
  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": ["s3:ListBucket"],
      "Effect": "Allow",
      "Resource": ["*"]
    },
    {
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Effect": "Allow",
      "Resource": ["*"]
    }
  ]
}
 EOF
}

resource "aws_iam_role" "cognito_unauthenticated" {
  name               = "cognito_unauthenticated"
  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "",
      "Effect": "Allow",
      "Principal": {
        "Federated": "cognito-identity.amazonaws.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "cognito-identity.amazonaws.com:aud": "arn:aws:s3:us-east-1:645689944584:accesspoint/lambda-authorizer"
        },
        "ForAnyValue:StringLike": {
          "cognito-identity.amazonaws.com:amr": "unauthenticated"
        }
      }
    }
  ]
}
 EOF
}

resource "aws_iam_role_policy" "web_iam_unauth_role_policy" {
  name   = "web_iam_unauth_role_policy"
  role   = aws_iam_role.cognito_unauthenticated.id
  policy = <<EOF
{
      "Version": "2012-10-17",
      "Statement": [
           {
                "Sid": "",
                "Action": "*",
                "Effect": "Deny",
                "Resource": "*"
           }
      ]
}
 EOF
}

resource "aws_iam_role" "creators_group_role" {
  name = "creators_group_role"

  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "",
      "Effect": "Allow",
      "Principal": {
        "Federated": "cognito-identity.amazonaws.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity"
    }
  ]
}
EOF
}

resource "aws_iam_role" "cloudfront_auth_role" {
  name = "cloudfront_auth_role"

  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": ["lambda.amazonaws.com", "edgelambda.amazonaws.com"]
      },
      "Effect": "Allow",
      "Sid": ""
    }
  ]
}
EOF
}

resource "aws_iam_role_policy_attachment" "cloudfront_auth_logging" {
  role       = aws_iam_role.cloudfront_auth_role.name
  policy_arn = aws_iam_policy.logging_policy.arn
}

resource "aws_iam_role_policy_attachment" "cloudfront_auth_dynamodb_access" {
  role       = aws_iam_role.cloudfront_auth_role.name
  policy_arn = aws_iam_policy.dynamodb_access.arn
}

# Lambdas

data "archive_file" "post_handler_zip" {
  type        = "zip"
  output_path = "lambdas_dist/post_handler.zip"
  source_dir  = "lambdas/post_handler/dist"
}

resource "aws_lambda_function" "post_handler" {
  filename         = "lambdas_dist/post_handler.zip"
  function_name    = "post_handler"
  handler          = "index.handler"
  role             = aws_iam_role.gateway_endpoint.arn
  runtime          = "nodejs14.x"
  timeout          = 6
  memory_size      = 2048
  source_code_hash = data.archive_file.post_handler_zip.output_base64sha256
}

resource "aws_lambda_permission" "trigger_post_handler" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.post_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.rest_api.execution_arn}/*/*"
}

data "archive_file" "creator_handler_zip" {
  type        = "zip"
  output_path = "lambdas_dist/creator_handler.zip"
  source_dir  = "lambdas/creator_handler/dist"
}

resource "aws_lambda_function" "creator_handler" {
  filename         = "lambdas_dist/creator_handler.zip"
  function_name    = "creator_handler"
  handler          = "index.handler"
  role             = aws_iam_role.gateway_endpoint.arn
  runtime          = "nodejs14.x"
  timeout          = 60
  memory_size      = 1024
  source_code_hash = data.archive_file.creator_handler_zip.output_base64sha256
}

resource "aws_lambda_permission" "trigger_creator_handler" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.creator_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.rest_api.execution_arn}/*/*"
}

data "archive_file" "create_auth_challenge_zip" {
  type        = "zip"
  output_path = "lambdas_dist/create_auth_challenge.zip"
  source_dir  = "lambdas/create_auth_challenge/dist"
}

resource "aws_lambda_function" "create_auth_challenge" {
  filename         = "lambdas_dist/create_auth_challenge.zip"
  function_name    = "create_auth_challenge"
  handler          = "index.handler"
  role             = aws_iam_role.custom_auth_access_role.arn
  runtime          = "nodejs14.x"
  source_code_hash = data.archive_file.create_auth_challenge_zip.output_base64sha256
}

resource "aws_lambda_permission" "trigger_create_auth_challenge" {
  statement_id  = "AllowExecutionFromUserPool"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.create_auth_challenge.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.user_pool.arn
}

data "archive_file" "define_auth_challenge_zip" {
  type        = "zip"
  output_path = "lambdas_dist/define_auth_challenge.zip"
  source_dir  = "lambdas/define_auth_challenge/dist"
}

resource "aws_lambda_function" "define_auth_challenge" {
  filename         = "lambdas_dist/define_auth_challenge.zip"
  function_name    = "define_auth_challenge"
  handler          = "index.handler"
  role             = aws_iam_role.custom_auth_access_role.arn
  runtime          = "nodejs14.x"
  source_code_hash = data.archive_file.define_auth_challenge_zip.output_base64sha256
}

resource "aws_lambda_permission" "trigger_define_auth_challenge" {
  statement_id  = "AllowExecutionFromUserPool"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.define_auth_challenge.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.user_pool.arn
}

data "archive_file" "verify_auth_challenge_zip" {
  type        = "zip"
  output_path = "lambdas_dist/verify_auth_challenge.zip"
  source_dir  = "lambdas/verify_auth_challenge/dist"
}

resource "aws_lambda_function" "verify_auth_challenge" {
  filename         = "lambdas_dist/verify_auth_challenge.zip"
  function_name    = "verify_auth_challenge"
  handler          = "index.handler"
  role             = aws_iam_role.custom_auth_access_role.arn
  runtime          = "nodejs14.x"
  source_code_hash = data.archive_file.verify_auth_challenge_zip.output_base64sha256
}

resource "aws_lambda_permission" "trigger_verify_auth_challenge" {
  statement_id  = "AllowExecutionFromUserPool"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.verify_auth_challenge.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.user_pool.arn
}

data "archive_file" "pre_sign_up_zip" {
  type        = "zip"
  output_path = "lambdas_dist/pre_sign_up.zip"
  source_dir  = "lambdas/pre_sign_up/dist"
}

resource "aws_lambda_function" "pre_sign_up" {
  filename         = "lambdas_dist/pre_sign_up.zip"
  function_name    = "pre_sign_up"
  handler          = "index.handler"
  role             = aws_iam_role.custom_auth_access_role.arn
  runtime          = "nodejs14.x"
  source_code_hash = data.archive_file.pre_sign_up_zip.output_base64sha256
}

resource "aws_lambda_permission" "trigger_pre_sign_up" {
  statement_id  = "AllowExecutionFromUserPool"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.pre_sign_up.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.user_pool.arn
}

# Route 53 & Certs

resource "aws_route53_zone" "apex" {
  name = "${replace(var.domain_name, "/^www\\./", "")}."
  tags = local.tags
}

resource "aws_route53_record" "cert_validation" {
  name    = tolist(aws_acm_certificate.cert.domain_validation_options)[0].resource_record_name
  type    = tolist(aws_acm_certificate.cert.domain_validation_options)[0].resource_record_type
  zone_id = aws_route53_zone.apex.id
  records = [
    tolist(aws_acm_certificate.cert.domain_validation_options)[0].resource_record_value
  ]
  ttl = 900
}

resource "aws_route53_record" "cert_validation_alt1" {
  name    = tolist(aws_acm_certificate.cert.domain_validation_options)[1].resource_record_name
  type    = tolist(aws_acm_certificate.cert.domain_validation_options)[1].resource_record_type
  zone_id = aws_route53_zone.apex.id
  records = [
    tolist(aws_acm_certificate.cert.domain_validation_options)[1].resource_record_value
  ]
  ttl = 900
}

resource "aws_route53_record" "cert_validation_alt2" {
  name    = tolist(aws_acm_certificate.cert.domain_validation_options)[2].resource_record_name
  type    = tolist(aws_acm_certificate.cert.domain_validation_options)[2].resource_record_type
  zone_id = aws_route53_zone.apex.id
  records = [
    tolist(aws_acm_certificate.cert.domain_validation_options)[2].resource_record_value
  ]
  ttl = 900
}

resource "aws_route53_record" "cert_validation_alt3" {
  name    = tolist(aws_acm_certificate.cert.domain_validation_options)[3].resource_record_name
  type    = tolist(aws_acm_certificate.cert.domain_validation_options)[3].resource_record_type
  zone_id = aws_route53_zone.apex.id
  records = [
    tolist(aws_acm_certificate.cert.domain_validation_options)[3].resource_record_value
  ]
  ttl = 900
}

resource "aws_route53_record" "api_gateway" {
  depends_on = [
    aws_api_gateway_domain_name.api_endpoint
  ]

  name    = aws_api_gateway_domain_name.api_endpoint.domain_name
  type    = "A"
  zone_id = aws_route53_zone.apex.id

  alias {
    evaluate_target_health = false
    name                   = aws_api_gateway_domain_name.api_endpoint.cloudfront_domain_name
    zone_id                = aws_api_gateway_domain_name.api_endpoint.cloudfront_zone_id
  }
}

resource "aws_route53_record" "cdn" {
  depends_on = [
    aws_cloudfront_distribution.private_content
  ]

  name    = "cdn.${var.domain_name}"
  type    = "A"
  zone_id = aws_route53_zone.apex.id

  alias {
    evaluate_target_health = false
    name                   = aws_cloudfront_distribution.private_content.domain_name
    zone_id                = aws_cloudfront_distribution.private_content.hosted_zone_id
  }
}

resource "aws_acm_certificate_validation" "cert" {
  certificate_arn = aws_acm_certificate.cert.arn
  validation_record_fqdns = [
    aws_route53_record.cert_validation.fqdn,
    aws_route53_record.cert_validation_alt1.fqdn,
    aws_route53_record.cert_validation_alt2.fqdn,
    aws_route53_record.cert_validation_alt3.fqdn
  ]
}

resource "aws_acm_certificate" "cert" {
  domain_name = replace(var.domain_name, "/^www\\./", "")
  subject_alternative_names = [
    "${substr(var.domain_name, 0, 4) == "www." ? "" : "www."}${var.domain_name}",
    "api.${var.domain_name}",
    "cdn.${var.domain_name}"
  ]
  validation_method = "DNS"
}

# Cognito

resource "aws_cognito_user_pool" "user_pool" {
  name = "keyther_pool"

  lambda_config {
    create_auth_challenge          = aws_lambda_function.create_auth_challenge.arn
    define_auth_challenge          = aws_lambda_function.define_auth_challenge.arn
    verify_auth_challenge_response = aws_lambda_function.verify_auth_challenge.arn

    pre_sign_up = aws_lambda_function.pre_sign_up.arn
  }
}

resource "aws_cognito_user_pool_client" "client" {
  name                = "keyther_client"
  user_pool_id        = aws_cognito_user_pool.user_pool.id
  explicit_auth_flows = ["CUSTOM_AUTH_FLOW_ONLY"]

  callback_urls = ["https://keyther.com/auth-login/", "http://localhost:3000"]
  logout_urls   = ["https://keyther.com", "http://localhost:3000"]

  default_redirect_uri = "https://keyther.com/auth-login/"

  generate_secret = false
}

resource "aws_cognito_identity_pool" "keyther_identities" {
  identity_pool_name               = "keyther_identities"
  allow_unauthenticated_identities = false

  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.client.id
    provider_name           = aws_cognito_user_pool.user_pool.endpoint
    server_side_token_check = false
  }
}

resource "aws_cognito_identity_pool_roles_attachment" "main" {
  identity_pool_id = aws_cognito_identity_pool.keyther_identities.id

  roles = {
    "authenticated"   = aws_iam_role.cognito_authenticated.arn
    "unauthenticated" = aws_iam_role.cognito_unauthenticated.arn
  }
}

resource "aws_cognito_user_group" "main" {
  name         = "creators-group"
  user_pool_id = aws_cognito_user_pool.user_pool.id
  role_arn     = aws_iam_role.creators_group_role.arn
}

# S3

resource "aws_s3_bucket" "private_content" {
  bucket = var.content_bucket
  acl    = "private"
  tags   = local.tags

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = ["*"]
    expose_headers  = ["Content-Range", "Content-Length", "ETag"]
    max_age_seconds = 3000
  }
}

data "aws_iam_policy_document" "s3_bucket_policy" {
  statement {
    actions = [
      "s3:GetObject",
      "s3:PutObject"
    ]

    resources = [
      "${aws_s3_bucket.private_content.arn}/*",
    ]

    principals {
      type = "AWS"
      identifiers = [
        aws_cloudfront_origin_access_identity.default.iam_arn,
      ]
    }
  }

  statement {
    actions = [
      "s3:ListBucket",
    ]

    resources = [
      aws_s3_bucket.private_content.arn,
    ]

    principals {
      type = "AWS"
      identifiers = [
        aws_cloudfront_origin_access_identity.default.iam_arn,
      ]
    }
  }
}

resource "aws_s3_bucket_policy" "bucket_policy" {
  bucket = aws_s3_bucket.private_content.id
  policy = data.aws_iam_policy_document.s3_bucket_policy.json
}

data "archive_file" "cloudfront_auth_zip" {
  type        = "zip"
  output_path = "lambdas_dist/cloudfront_auth.zip"
  source_dir  = "lambdas/cloudfront_auth/dist"
}

resource "aws_lambda_function" "cloudfront_auth" {
  filename         = "lambdas_dist/cloudfront_auth.zip"
  function_name    = "cloudfront_auth"
  handler          = "index.handler"
  role             = aws_iam_role.cloudfront_auth_role.arn
  runtime          = "nodejs14.x"
  source_code_hash = data.archive_file.cloudfront_auth_zip.output_base64sha256
}

resource "aws_lambda_permission" "allow_cloudfront_auth" {
  statement_id  = "AllowExecutionFromCloudFront"
  action        = "lambda:GetFunction"
  function_name = aws_lambda_function.cloudfront_auth.function_name
  principal     = "edgelambda.amazonaws.com"
}

data "archive_file" "cloudfront_cors_response_zip" {
  type        = "zip"
  output_path = "lambdas_dist/cloudfront_cors_response.zip"
  source_dir  = "lambdas/cloudfront_cors_response/dist"
}

resource "aws_lambda_function" "cloudfront_cors_response" {
  filename         = "lambdas_dist/cloudfront_cors_response.zip"
  function_name    = "cloudfront_cors_response"
  handler          = "index.handler"
  role             = aws_iam_role.cloudfront_auth_role.arn
  runtime          = "nodejs14.x"
  source_code_hash = data.archive_file.cloudfront_cors_response_zip.output_base64sha256
}

resource "aws_lambda_permission" "allow_cloudfront_cors_response" {
  statement_id  = "AllowExecutionFromCloudFront"
  action        = "lambda:GetFunction"
  function_name = aws_lambda_function.cloudfront_cors_response.function_name
  principal     = "edgelambda.amazonaws.com"
}

# Cloudfront

resource "aws_cloudfront_origin_access_identity" "default" {
  comment = var.content_bucket
}

resource "aws_cloudfront_distribution" "private_content" {
  origin {
    domain_name = aws_s3_bucket.private_content.bucket_regional_domain_name
    origin_id   = "S3-${var.content_bucket}"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.default.cloudfront_access_identity_path
    }
  }

  aliases = ["cdn.${var.domain_name}"]

  enabled         = true
  http_version    = "http2"
  is_ipv6_enabled = true
  price_class     = "PriceClass_100"
  tags            = local.tags

  default_cache_behavior {
    target_origin_id = "S3-${var.content_bucket}"

    allowed_methods = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]

    cached_methods = [
      "GET",
      "HEAD"
    ]

    forwarded_values {
      query_string = true
      headers = [
        "Access-Control-Request-Headers",
        "Access-Control-Request-Method",
        "Origin"
      ]

      cookies {
        forward = "none"
      }
    }

    lambda_function_association {
      event_type = "viewer-request"
      lambda_arn = "${aws_lambda_function.cloudfront_auth.arn}:45"
    }

    viewer_protocol_policy = "redirect-to-https"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
      locations        = []
    }
  }

  viewer_certificate {
    acm_certificate_arn = aws_acm_certificate_validation.cert.certificate_arn
    ssl_support_method  = "sni-only"
  }
}

# Dynamodb

resource "aws_dynamodb_table" "posts" {
  name         = "posts"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "community"
  range_key    = "creationDate"

  attribute {
    name = "community"
    type = "S"
  }

  attribute {
    name = "creationDate"
    type = "S"
  }

  attribute {
    name = "visibility"
    type = "S"
  }

  attribute {
    name = "author"
    type = "S"
  }

  global_secondary_index {
    name            = "DateIndex"
    hash_key        = "visibility"
    range_key       = "creationDate"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "AuthorIndex"
    hash_key        = "author"
    range_key       = "creationDate"
    projection_type = "ALL"
  }
}

resource "aws_dynamodb_table" "creators" {
  name         = "creators"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "address"

  attribute {
    name = "address"
    type = "S"
  }
}

resource "aws_dynamodb_table" "files_metadata" {
  name         = "files_metadata"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "uri"

  attribute {
    name = "uri"
    type = "S"
  }
}

# API Gateway

resource "aws_api_gateway_rest_api" "rest_api" {
  name        = "Keyther API"
  description = "API to serve as backend for Keyther"
}

resource "aws_api_gateway_deployment" "main" {
  rest_api_id = aws_api_gateway_rest_api.rest_api.id
  stage_name  = "dev"

  # triggers = {
  #   redeployment = sha1(jsonencode(aws_api_gateway_rest_api.main.body))
  # }

  description = "Created at ${timestamp()}"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_domain_name" "api_endpoint" {
  certificate_arn = aws_acm_certificate_validation.cert.certificate_arn
  domain_name     = "api.${var.domain_name}"
}

resource "aws_api_gateway_base_path_mapping" "base_path" {
  api_id      = aws_api_gateway_rest_api.rest_api.id
  stage_name  = aws_api_gateway_deployment.main.stage_name
  domain_name = aws_api_gateway_domain_name.api_endpoint.domain_name
}

resource "aws_api_gateway_authorizer" "cognito_auth" {
  name            = "api-authorizer"
  rest_api_id     = aws_api_gateway_rest_api.rest_api.id
  identity_source = "method.request.header.Authorization"
  type            = "COGNITO_USER_POOLS"
  provider_arns   = [aws_cognito_user_pool.user_pool.arn]
}

module "post_endpoint" {
  source       = "./tf_modules/cognito-authed-endpoint"
  dependencies = [aws_lambda_function.post_handler]

  path               = "posts"
  method             = "ANY"
  lambda_invoke_arn  = aws_lambda_function.post_handler.invoke_arn
  rest_api_id        = aws_api_gateway_rest_api.rest_api.id
  parent_resource_id = aws_api_gateway_rest_api.rest_api.root_resource_id
  authorizer_id      = aws_api_gateway_authorizer.cognito_auth.id
}

module "post_community_endpoint" {
  source       = "./tf_modules/cognito-authed-endpoint"
  dependencies = [aws_lambda_function.post_handler]

  path               = "{community+}"
  method             = "ANY"
  lambda_invoke_arn  = aws_lambda_function.post_handler.invoke_arn
  rest_api_id        = aws_api_gateway_rest_api.rest_api.id
  parent_resource_id = module.post_endpoint.resource_id
  authorizer_id      = aws_api_gateway_authorizer.cognito_auth.id
}

module "creator_endpoint" {
  source       = "./tf_modules/cognito-authed-endpoint"
  dependencies = [aws_lambda_function.creator_handler]

  path               = "creators"
  method             = "ANY"
  lambda_invoke_arn  = aws_lambda_function.creator_handler.invoke_arn
  rest_api_id        = aws_api_gateway_rest_api.rest_api.id
  parent_resource_id = aws_api_gateway_rest_api.rest_api.root_resource_id
  authorizer_id      = aws_api_gateway_authorizer.cognito_auth.id
}

module "creator_address_endpoint" {
  source       = "./tf_modules/cognito-authed-endpoint"
  dependencies = [aws_lambda_function.creator_handler]

  path               = "{address+}"
  method             = "ANY"
  lambda_invoke_arn  = aws_lambda_function.creator_handler.invoke_arn
  rest_api_id        = aws_api_gateway_rest_api.rest_api.id
  parent_resource_id = module.creator_endpoint.resource_id
  authorizer_id      = aws_api_gateway_authorizer.cognito_auth.id
}

# resource "aws_api_gateway_resource" "post_proxy" {
#   rest_api_id = aws_api_gateway_rest_api.rest_api.id
#   parent_id   = aws_api_gateway_rest_api.rest_api.root_resource_id
#   path_part   = "{proxy+}"
# }


# Outputs

output "cognito_identity_pool_id" {
  value = aws_cognito_identity_pool.keyther_identities.id
}

output "bucket_domain_name" {
  value = aws_s3_bucket.private_content.bucket_regional_domain_name
}
