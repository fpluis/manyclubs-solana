terraform {
  required_version = ">= 0.13"
  backend "s3" {
    bucket  = "keyther-tfstate"
    key     = "keyther"
    region  = "eu-west-1"
    encrypt = true
  }
}
