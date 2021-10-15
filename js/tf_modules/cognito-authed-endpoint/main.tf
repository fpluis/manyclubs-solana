variable "path" {
  description = "The API path"
  type        = string
}

variable "method" {
  description = "The method used to call the endpoint"
  type        = string
}

variable "lambda_invoke_arn" {
  description = "The Lambda's invoke ARN"
  type        = string
}

variable "rest_api_id" {
  description = "The id of the REST API"
  type        = string
}

variable "parent_resource_id" {
  description = "API Gateway's parent resource id"
  type        = string
}

variable "authorizer_id" {
  description = "API Gateway's Cognito authorizer id"
  type        = string
  default     = null
}

variable "request_models" {
  description = "API Gateway's Cognito authorizer id"
  type        = map
  default     = {}
}

variable "dependencies" {
  type    = list
  default = []
}

resource "aws_api_gateway_resource" "main" {
  rest_api_id = var.rest_api_id
  parent_id   = var.parent_resource_id
  path_part   = var.path
}

resource "aws_api_gateway_method" "main" {
  rest_api_id = var.rest_api_id
  resource_id = aws_api_gateway_resource.main.id

  request_models = var.request_models

  authorization = var.authorizer_id == null ? "NONE" : "COGNITO_USER_POOLS"
  authorizer_id = var.authorizer_id

  http_method = var.method
}

resource "aws_api_gateway_method" "cors" {
  rest_api_id   = var.rest_api_id
  resource_id   = aws_api_gateway_resource.main.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "cors" {
  rest_api_id = var.rest_api_id
  resource_id = aws_api_gateway_resource.main.id
  http_method = aws_api_gateway_method.cors.http_method

  type = "MOCK"

  request_templates = {
    "application/json" = "{ \"statusCode\": 200 }"
  }
}

resource "aws_api_gateway_integration_response" "cors" {
  rest_api_id = var.rest_api_id
  resource_id = aws_api_gateway_resource.main.id
  http_method = aws_api_gateway_method.cors.http_method
  status_code = 200

  response_parameters = {
    "method.response.header.Access-Control-Max-Age"       = "'7200'"
    "method.response.header.Access-Control-Allow-Headers" = "'Authorization,Content-Type'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
    "method.response.header.Access-Control-Allow-Methods" = "'OPTIONS,HEAD,GET,POST,PUT,PATCH,DELETE'"
  }

  depends_on = [
    aws_api_gateway_integration.cors,
    aws_api_gateway_method_response.cors,
  ]
}

resource "aws_api_gateway_method_response" "cors" {
  rest_api_id = var.rest_api_id
  resource_id = aws_api_gateway_resource.main.id
  http_method = aws_api_gateway_method.cors.http_method
  status_code = 200

  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = {
    "method.response.header.Access-Control-Max-Age"       = true
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Methods" = true
  }

  depends_on = [
    aws_api_gateway_method.cors,
  ]
}

resource "aws_api_gateway_integration" "main" {
  rest_api_id = var.rest_api_id
  resource_id = aws_api_gateway_resource.main.id
  http_method = aws_api_gateway_method.main.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.lambda_invoke_arn
}

output "resource_id" {
  value = aws_api_gateway_resource.main.id
}