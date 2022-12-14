const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const ora = require('ora')
const { read } = require('node-yaml')
const yaml = require('js-yaml')
const write = require('write-yaml-file')
const execa = require('execa')

const _ = require('lodash')

const constants = require('../../constants')
const log = require('../../utils/log')
const copy = require('../copy')

const spinner = ora({ text: '' })

const generate = ({ answers }) => {
  const {
    platform,
    workflows,
    environment,
    publish,
    dockerfile,
    dockerignore,
    version,
    customVersion,
    provider,
    generateProcfile,
    generateToml,
    override,
    extras,
    dependabot,
    dependabotPackageManager
  } = answers

  if (workflows.includes(constants.CI_WORKFLOW)) {
    const src = path.join(
      __dirname,
      `${constants.TEMPLATE_PATH}/${platform}/ci/${environment}-ci.yml`
    )
    const dest = path.join(process.cwd(), `.${platform}/workflows/ci.yml`)

    if (dest && !override) {
      return log(
        chalk.red('CI file is already exist and cannot override it'),
        constants.LOG_TYPE_ERROR
      )
    }

    spinner.start(`Scaffold ${environment} CI`)

    fs.cp(src, dest, { recursive: true }, async (err) => {
      if (err) {
        return log(
          chalk.red(`An error occured while scaffolding ${environment} CI.`, err),
          constants.LOG_TYPE_ERROR
        )
      }

      await read(dest)
        .then(() => {
          const yml = yaml.load(fs.readFileSync(dest, 'utf8'))

          if (version) {
            yml.jobs.build.strategy.matrix[`${environment}-version`] = customVersion
          }

          write(dest, yml).catch((err) => {
            log(chalk.red(err), constants.LOG_TYPE_ERROR)
          })
        })
        .catch((err) => {
          log(chalk.red(err), constants.LOG_TYPE_ERROR)
        })

      spinner.succeed(`${_.capitalize(environment)} CI scaffolded!`)
    })
  }

  if (workflows.includes(constants.CD_WORKFLOW)) {
    const src = path.join(
      __dirname,
      `${constants.TEMPLATE_PATH}/${platform}/providers/${provider}.yml`
    )
    const dest = path.join(process.cwd(), `.${platform}/workflows/cd.yml`)

    if (dest && !override) {
      return log(
        chalk.red('CD file is already exist and cannot override it'),
        constants.LOG_TYPE_ERROR
      )
    }

    if (generateProcfile) {
      spinner.start('Generate Heroku Procfile')

      execa('touch', ['Procfile']).then(() => {
        const dest = path.join(process.cwd(), 'Procfile')
        const content = constants.PROCFILE_CONFIG[environment]

        if (dest && !override) {
          return log(
            chalk.red('Procfile file is already exist and cannot override it'),
            constants.LOG_TYPE_ERROR
          )
        }

        fs.writeFile(dest, content, (err) => {
          if (err) {
            return log(
              chalk.red('An error occured while generating Heroku Procfile', err),
              constants.LOG_TYPE_ERROR
            )
          }

          spinner.succeed('Heroku Procfile generated')
        })
      })
    }

    if (generateToml) {
      execa('touch', ['netlify.toml']).then(() => {
        const src = path.join(__dirname, `${constants.TEMPLATE_PATH}/config/${provider}.toml`)
        const dest = path.join(process.cwd(), 'netlify.toml')

        if (dest && !override) {
          return log(
            chalk.red('Netlify toml file is already exist and cannot override it'),
            constants.LOG_TYPE_ERROR
          )
        }

        copy({
          src,
          dest,
          spinnerMsg: 'Generate Netlify Toml',
          errorMsg: 'An error occured while generating Netlify Toml',
          successMsg: 'Netlify Toml generated'
        })
      })
    }

    if (publish) {
      const src = path.join(__dirname, `${constants.TEMPLATE_PATH}/${platform}/extras/publish.yml`)
      const dest = path.join(process.cwd(), `.${platform}/workflows/publish.yml`)

      if (dest && !override) {
        return log(
          chalk.red('Publish file is already exist and cannot override it'),
          constants.LOG_TYPE_ERROR
        )
      }

      copy({
        src,
        dest,
        spinnerMsg: 'Generate script for publish on Docker Hub',
        errorMsg: 'An error occured while generating script for publish on Docker Hub',
        successMsg: 'Docker Hub publish script generated'
      })
    }

    if (dockerfile) {
      const src = path.join(
        __dirname,
        `${constants.TEMPLATE_PATH}/config/docker/dockerfiles/${environment}.Dockerfile`
      )
      const dest = path.join(process.cwd(), 'Dockerfile')

      if (dest && !override) {
        return log(
          chalk.red('Dockerfile file is already exist and cannot override it'),
          constants.LOG_TYPE_ERROR
        )
      }

      copy({
        src,
        dest,
        spinnerMsg: 'Generate Dockerfile',
        errorMsg: 'An error occured while generating Dockerfile',
        successMsg: 'Dockerfile generated'
      })

      if (dockerignore) {
        const src = path.join(__dirname, `${constants.TEMPLATE_PATH}/config/docker/.dockerignore`)
        const dest = path.join(process.cwd(), '.dockerignore')

        if (dest && !override) {
          return log(
            chalk.red('.dockerignore file is already exist and cannot override it'),
            constants.LOG_TYPE_ERROR
          )
        }

        copy({
          src,
          dest,
          spinnerMsg: 'Generate .dockerignore',
          errorMsg: 'An error occured while generating .dockerignore',
          successMsg: '.dockerignore generated'
        })
      }
    }

    copy({
      src,
      dest,
      spinnerMsg: `Scaffold ${environment} CD`,
      errorMsg: `An error occured while scaffolding ${environment} CD.`,
      successMsg: `${_.capitalize(environment)} CD scaffolded!`
    })
  }

  if (Array.isArray(extras) && extras.length > 0) {
    extras.forEach((e) => {
      const key = constants.EXTRAS_KEY

      const src = path.join(
        __dirname,
        `${constants.TEMPLATE_PATH}/${platform}/extras/${key[e]}.yml`
      )
      const dest = path.join(process.cwd(), `.${platform}/workflows/${key[e]}.yml`)

      if (dest && !override) {
        return log(
          chalk.red(`${e} file is already exist and cannot override it`),
          constants.LOG_TYPE_ERROR
        )
      }

      copy({
        src,
        dest,
        spinnerMsg: `Generate ${key[e]}`,
        errorMsg: `An error occured while generating ${key[e]}.`,
        successMsg: `${e} file generated!`
      })
    })
  }

  if (dependabot) {
    const src = path.join(__dirname, `${constants.TEMPLATE_PATH}/${platform}/extras/dependabot.yml`)
    const dest = path.join(process.cwd(), `.${platform}/dependabot.yml`)

    if (dest && !override) {
      return log(
        chalk.red('Dependabot file is already exist and cannot override it'),
        constants.LOG_TYPE_ERROR
      )
    }

    spinner.start('Generate dependabot')

    fs.cp(src, dest, { recursive: true }, async (err) => {
      if (err) {
        return log(
          chalk.red('An error occured while generating dependabot.', err),
          constants.LOG_TYPE_ERROR
        )
      }

      await read(dest)
        .then(() => {
          const yml = yaml.load(fs.readFileSync(dest, 'utf8'))

          if (dependabotPackageManager) {
            yml.updates[1]['package-ecosystem'] = dependabotPackageManager
          }

          write(dest, yml).catch((err) => {
            log(chalk.red(err), constants.LOG_TYPE_ERROR)
          })
        })
        .catch((err) => {
          log(chalk.red(err), constants.LOG_TYPE_ERROR)
        })

      spinner.succeed('Dependabot file generated!')
    })
  }
}

module.exports = { generate }
