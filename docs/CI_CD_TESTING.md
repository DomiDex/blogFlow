# CI/CD Testing Integration Guide

## Overview

This guide provides configuration examples for integrating the test suite into various CI/CD platforms.

## GitHub Actions

### Basic Test Workflow

Create `.github/workflows/test.yml`:

```yaml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - uses: denoland/setup-deno@v1
      with:
        deno-version: v1.x
    
    - name: Cache Dependencies
      uses: actions/cache@v3
      with:
        path: |
          ~/.deno
          ~/.cache/deno
        key: ${{ runner.os }}-deno-${{ hashFiles('**/deno.lock') }}
    
    - name: Run Linting
      run: deno task lint
    
    - name: Type Check
      run: deno check src/**/*.ts
    
    - name: Run Unit Tests
      run: deno task test:unit
    
    - name: Run Integration Tests
      run: deno task test:integration
      env:
        WEBFLOW_API_TOKEN: ${{ secrets.WEBFLOW_API_TOKEN }}
        WEBFLOW_COLLECTION_ID: ${{ secrets.WEBFLOW_COLLECTION_ID }}
        WEBFLOW_SITE_ID: ${{ secrets.WEBFLOW_SITE_ID }}
    
    - name: Generate Coverage Report
      run: deno task test:coverage
    
    - name: Upload Coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/coverage.lcov
        fail_ci_if_error: true
```

### Performance Testing Workflow

Create `.github/workflows/performance.yml`:

```yaml
name: Performance Tests

on:
  schedule:
    - cron: '0 0 * * 0' # Weekly on Sunday
  workflow_dispatch:

jobs:
  performance:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - uses: denoland/setup-deno@v1
    
    - name: Run Performance Tests
      run: deno task test:performance
    
    - name: Upload Results
      uses: actions/upload-artifact@v3
      with:
        name: performance-results
        path: performance-results.json
        retention-days: 90
```

## GitLab CI

Create `.gitlab-ci.yml`:

```yaml
image: denoland/deno:alpine

stages:
  - validate
  - test
  - coverage

cache:
  paths:
    - .deno/

lint:
  stage: validate
  script:
    - deno task lint
    - deno fmt --check

type-check:
  stage: validate
  script:
    - deno check src/**/*.ts

unit-tests:
  stage: test
  script:
    - deno task test:unit
  artifacts:
    reports:
      junit: test-results.xml

integration-tests:
  stage: test
  script:
    - deno task test:integration
  variables:
    WEBFLOW_API_TOKEN: $WEBFLOW_API_TOKEN
    WEBFLOW_COLLECTION_ID: $WEBFLOW_COLLECTION_ID
    WEBFLOW_SITE_ID: $WEBFLOW_SITE_ID

coverage:
  stage: coverage
  script:
    - deno task test:coverage
  coverage: '/cover (\d+\.\d+)%/'
  artifacts:
    paths:
      - coverage/
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/coverage.xml
```

## CircleCI

Create `.circleci/config.yml`:

```yaml
version: 2.1

executors:
  deno:
    docker:
      - image: denoland/deno:alpine
    working_directory: ~/repo

jobs:
  test:
    executor: deno
    steps:
      - checkout
      
      - restore_cache:
          keys:
            - v1-deno-{{ checksum "deno.lock" }}
            - v1-deno-
      
      - run:
          name: Install dependencies
          command: deno cache --lock=deno.lock src/main.ts
      
      - save_cache:
          paths:
            - ~/.cache/deno
          key: v1-deno-{{ checksum "deno.lock" }}
      
      - run:
          name: Lint
          command: deno task lint
      
      - run:
          name: Type Check
          command: deno check src/**/*.ts
      
      - run:
          name: Unit Tests
          command: deno task test:unit
      
      - run:
          name: Integration Tests
          command: deno task test:integration
          environment:
            WEBFLOW_API_TOKEN: ${WEBFLOW_API_TOKEN}
            WEBFLOW_COLLECTION_ID: ${WEBFLOW_COLLECTION_ID}
            WEBFLOW_SITE_ID: ${WEBFLOW_SITE_ID}
      
      - run:
          name: Coverage
          command: deno task test:coverage
      
      - store_test_results:
          path: test-results
      
      - store_artifacts:
          path: coverage

workflows:
  version: 2
  test:
    jobs:
      - test
```

## Jenkins

Create `Jenkinsfile`:

```groovy
pipeline {
    agent {
        docker {
            image 'denoland/deno:alpine'
        }
    }
    
    environment {
        DENO_DIR = "${WORKSPACE}/.deno"
        WEBFLOW_API_TOKEN = credentials('webflow-api-token')
        WEBFLOW_COLLECTION_ID = credentials('webflow-collection-id')
        WEBFLOW_SITE_ID = credentials('webflow-site-id')
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Cache Dependencies') {
            steps {
                sh 'deno cache --lock=deno.lock src/main.ts'
            }
        }
        
        stage('Validate') {
            parallel {
                stage('Lint') {
                    steps {
                        sh 'deno task lint'
                    }
                }
                stage('Type Check') {
                    steps {
                        sh 'deno check src/**/*.ts'
                    }
                }
                stage('Format Check') {
                    steps {
                        sh 'deno fmt --check'
                    }
                }
            }
        }
        
        stage('Test') {
            parallel {
                stage('Unit Tests') {
                    steps {
                        sh 'deno task test:unit'
                    }
                }
                stage('Integration Tests') {
                    steps {
                        sh 'deno task test:integration'
                    }
                }
            }
        }
        
        stage('Coverage') {
            steps {
                sh 'deno task test:coverage'
                publishHTML([
                    allowMissing: false,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: 'coverage/html',
                    reportFiles: 'index.html',
                    reportName: 'Coverage Report'
                ])
            }
        }
    }
    
    post {
        always {
            junit 'test-results/**/*.xml'
            cleanWs()
        }
    }
}
```

## Azure DevOps

Create `azure-pipelines.yml`:

```yaml
trigger:
- main
- develop

pool:
  vmImage: 'ubuntu-latest'

variables:
  DENO_DIR: $(Pipeline.Workspace)/.deno

steps:
- task: Cache@2
  inputs:
    key: 'deno | "$(Agent.OS)" | deno.lock'
    path: $(DENO_DIR)
  displayName: Cache Deno dependencies

- script: |
    curl -fsSL https://deno.land/x/install/install.sh | sh
    echo "##vso[task.prependpath]$HOME/.deno/bin"
  displayName: 'Install Deno'

- script: deno --version
  displayName: 'Check Deno version'

- script: deno task lint
  displayName: 'Lint'

- script: deno check src/**/*.ts
  displayName: 'Type Check'

- script: deno task test:unit
  displayName: 'Unit Tests'

- script: deno task test:integration
  displayName: 'Integration Tests'
  env:
    WEBFLOW_API_TOKEN: $(WEBFLOW_API_TOKEN)
    WEBFLOW_COLLECTION_ID: $(WEBFLOW_COLLECTION_ID)
    WEBFLOW_SITE_ID: $(WEBFLOW_SITE_ID)

- script: deno task test:coverage
  displayName: 'Generate Coverage'

- task: PublishTestResults@2
  inputs:
    testResultsFormat: 'JUnit'
    testResultsFiles: '**/test-results.xml'
    failTaskOnFailedTests: true
  displayName: 'Publish Test Results'

- task: PublishCodeCoverageResults@1
  inputs:
    codeCoverageTool: 'Cobertura'
    summaryFileLocation: '$(System.DefaultWorkingDirectory)/coverage/coverage.xml'
    reportDirectory: '$(System.DefaultWorkingDirectory)/coverage/html'
  displayName: 'Publish Code Coverage'
```

## Docker Integration

### Dockerfile for CI

Create `Dockerfile.ci`:

```dockerfile
FROM denoland/deno:alpine

WORKDIR /app

# Copy dependency files
COPY deno.json deno.lock ./

# Cache dependencies
RUN deno cache --lock=deno.lock src/main.ts || true

# Copy source code
COPY . .

# Run tests
CMD ["deno", "task", "test"]
```

### Docker Compose for Testing

Create `docker-compose.test.yml`:

```yaml
version: '3.8'

services:
  test:
    build:
      context: .
      dockerfile: Dockerfile.ci
    environment:
      - NODE_ENV=test
      - LOG_LEVEL=error
      - WEBFLOW_API_TOKEN=test-token
      - WEBFLOW_COLLECTION_ID=test-collection-id
      - WEBFLOW_SITE_ID=test-site-id
    volumes:
      - ./coverage:/app/coverage
    command: deno task test:coverage
```

## Best Practices

### 1. Environment Variables

Store sensitive data in CI/CD secrets:
- `WEBFLOW_API_TOKEN`
- `WEBFLOW_COLLECTION_ID`
- `WEBFLOW_SITE_ID`

### 2. Caching

Cache Deno dependencies to speed up builds:
- Cache key should include OS and lock file hash
- Cache paths: `~/.deno`, `~/.cache/deno`, `$DENO_DIR`

### 3. Parallel Execution

Run independent tasks in parallel:
- Linting, type checking, and formatting
- Unit tests and integration tests

### 4. Test Results

- Export test results in JUnit format
- Publish coverage reports
- Set up status badges

### 5. Performance Monitoring

- Run performance tests on schedule
- Track metrics over time
- Alert on performance regressions

### 6. Branch Protection

Configure branch protection rules:
- Require passing tests
- Require code review
- Require up-to-date branches
- Enforce coverage thresholds

## Monitoring and Alerts

### Coverage Badges

Add to README.md:
```markdown
![Coverage](https://codecov.io/gh/username/repo/branch/main/graph/badge.svg)
![Tests](https://github.com/username/repo/workflows/Tests/badge.svg)
```

### Slack Notifications

```yaml
- name: Notify Slack
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: 'Tests failed on ${{ github.ref }}'
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

### Email Notifications

Most CI/CD platforms support email notifications on:
- Test failures
- Coverage drops
- Performance regressions