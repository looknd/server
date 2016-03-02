const router = require('koa-router')()
const jwt = require('koa-jwt')

const log = require('../lib/log')
const Page = require('../models/page')
const User = require('../models/user')

function *getOne (type, _id) {
  const query = eval(type + '.where({ _id })')

  try {
    var item = yield query.findOne()
  } catch (err) {
    return log('Couldn\'t load item', err)
  }

  var attributes = item.toObject()

  delete attributes._id
  delete attributes.__v
  delete attributes.password

  return {
    id: _id,
    type: type.toLowerCase(),
    attributes
  }
}

router.post('/token-auth', function *(next) {
  const body = this.request.body

  if (!body.username || !body.password) {
    this.status = 400
    this.body = {
      error: 'User and/or password empty'
    }
    return
  }

  const query = User.where({ _id: body.username })

  try {
    var user = yield query.findOne()
  } catch (err) {
    log('Couldn\'t load user', err)
  }

  if (!user) {
    this.status = 400
    this.body = {
      error: 'User doesn\'t exist'
    }
    return
  }

  // Compare password with the one within the DB
  const isMatch = user.tryPassword(body.password)

  if (isMatch) {
    const token = jwt.sign(body, process.env.SESSION_SECRET, {
      expiresIn: 300
    })

    this.body = {
      token
    }

    return
  }

  this.status = 400

  this.body = {
    error: 'Wrong password'
  }

  yield next
})

router.post('/token-refresh', function *(next) {
  const token = this.request.body.token

  try {
    const decoded = jwt.verify(token, process.env.SESSION_SECRET)
  } catch (err) {
    this.status = 401
    this.body = { error: err }

    return
  }

  const query = User.where({ _id: decoded.username })

  try {
    var user = yield query.findOne()
  } catch (err) {
    log('Couldn\'t load user', err)
  }

  if (!user) {
    this.status = 401
    this.body = {
      error: 'User doesn\'t exist'
    }

    return
  }

  const isMatch = user.tryPassword(decoded.password)

  if (isMatch) {
    this.body = {
      token: jwt.sign(decoded, process.env.SESSION_SECRET, {
        expiresIn: 300
      })
    }

    return
  }

  this.status = 401

  this.body = {
    error: 'Wrong password'
  }

  console.log(decoded)
})

router.get('/pages', function *(next) {
  try {
    var pages = yield Page.find()
  } catch (err) {
    return log('Couldn\'t load pages', err)
  }

  var data = []

  for (var page in pages) {
    var attributes = pages[page].toObject()
    var id = attributes.id

    delete attributes.id
    delete attributes._id
    delete attributes.__v

    data.push({
      id,
      type: 'pages',
      attributes
    })
  }

  this.body = { data }
  yield next
})

router.get('/pages/:id', function *(next) {
  this.body = {
    data: yield getOne('Page', this.params.id)
  }

  yield next
})

router.get('/users', function *(next) {
  try {
    var users = yield User.find()
  } catch (err) {
    return log('Couldn\'t load users', err)
  }

  var data = []

  for (var user in users) {
    const details = users[user].toObject()

    data.push({
      id: details._id,
      type: 'users',
      attributes: {
        email: details.email
      }
    })
  }

  this.body = { data }
  yield next
})

router.get('/users/:id', function *(next) {
  this.body = {
    data: yield getOne('User', this.params.id)
  }

  yield next
})

module.exports = router
