// Merge gate on Jenkins CI (Jenkins on the Jenkins CI VPS, ~/Projects/jenkins-ci).
// It runs the local gate unchanged, `scripts/ci-local.sh` (Node 24 from .nvmrc, no
// dependencies, Chrome from the agent's CHROME_PATH), and GitHub shows the result as the
// commit status `continuous-integration/jenkins/pr-head` on PRs (`.../branch` on main).
// If Jenkins is down or busy, run `bash scripts/ci-local.sh` and paste its tail on the PR.
pipeline {
  agent { label 'jenkins' }
  options {
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '30'))
    disableConcurrentBuilds(abortPrevious: true)
  }
  environment {
    CI = 'true'
  }
  stages {
    stage('scripts/ci-local.sh') {
      steps {
        sh '''#!/usr/bin/env bash
          set -eo pipefail
          . "$NVM_DIR/nvm.sh"
          nvm install    # .nvmrc (24)
          bash scripts/ci-local.sh
        '''
      }
    }
  }
}
