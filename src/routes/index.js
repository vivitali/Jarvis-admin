const path = require('path');
const createReadStream = require('fs').createReadStream;
const EmailService = require('../services/email.service');
const UsersService = require('../services/users.servise');
const DatabaseService = require('../services/database.service');
const ParseService = require('../services/parser.service');
const GoogleSheetToJSON = require('../services/google-api.service');

module.exports = ({ router }) => {
  // probably need to use koa-views or something... but if we have only one index.html.....
  router.get('/admin-panel', ctx => {
    const reader = createReadStream(path.join(__dirname, '/public/index.html'));
    return new Promise(resolve => {
      reader.on('data', chunk => {
        ctx.type = 'html';
        ctx.body = chunk.toString();
        resolve();
      });
    });
  });

  /* admin panel  */
  // TODO: need to add middleware to check permission;
  router.get('/admin/api/execute-sql', ctx => {
    return DatabaseService.runSql(ctx.query.query)
      .then(result => {
        ctx.status = 200;
        ctx.body = { result };
      })
      .catch(err => {
        ctx.throw(400, err);
      });
  });

  router.get('/api/parse', ctx => {
    const { CLIENT_EMAIL, PRIVATE_KEY, SPREAD_SHEET_ID } = process.env;
    const privateKey = PRIVATE_KEY.replace(/\\n/g, '\n');

    const gSheetToJSON = new GoogleSheetToJSON({
      CLIENT_EMAIL,
      PRIVATE_KEY: privateKey
    });

    return gSheetToJSON
      .getJson({
        spreadsheetId: SPREAD_SHEET_ID,
        range: 'Список власників автомобілів!A2:I1000'
      })
      .then(({ data, status = 401, statusText }) => {
        return new ParseService().normalizeRows(data.values);
      })
      .then(data => {
        return UsersService.bulkAddUsers(data);
      })
      .then(data => {
        ctx.status = 200;
        //ctx.statusText = statusText;
        ctx.body = 'ok';
      })
      .catch(err => {
        ctx.throw(400, err);
      });
  });

  /* APIs */
  router.get('/api/send-email/:car_number', ctx => {
    return UsersService.getUserByNumber(ctx.params.car_number)
      .then(user =>
        EmailService.sendEmail({
          to: user.email,
          subject: 'test subject',
          html: '<div>Test html...</div>'
        })
      )
      .then(() => (ctx.body = { status: 'ok' }))
      .catch(() => {});
  });

  router.post('/api/v1/process-number', ctx => {
    const data = ctx.request.body;
    const number = data[0].text;

    return UsersService.getUserByNumber(number)
      .then(user => (ctx.body = { user }))
      .catch(() => {});
  });
};
