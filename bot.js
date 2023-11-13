const { Client, GatewayIntentBits, REST } = require('discord.js')
const { Routes } = require('discord-api-types/v10')
const express = require('express')
const axios = require('axios')
require('dotenv').config()


//só por precaução
process.on('unhandledRejection', (error) => {
  console.error('promessa rejeitada:', error)
})

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
});

let accessToken = process.env.ACCESS_TOKEN
let refreshToken = process.env.REFRESH_TOKEN

//volto nisso depois
async function refreshAccessToken() {
  try {
    const refreshResponse = await axios.post('https://discord.com/api/oauth2/token', {
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      redirect_uri: 'http://localhost:3000/callback',
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

    accessToken = refreshResponse.data.access_token
    refreshToken = refreshResponse.data.refresh_token

    console.log('token redefinido:', accessToken)
  } catch (refreshError) {
    console.error('erro ao processar novo token:', refreshError.message)
    // do something here man
  }
}

const app = express();
const PORT = process.env.PORT || 3000

// route
app.get('/', (req, res) => {
  res.send('Hello! nothing to see here')
})

// OAuth2 callback
app.get('/callback', async (req, res) => {
  const code = req.query.code;

  if (code) {
    console.log(`Received OAuth2 code: ${code}`)

    try {
      // processa acess token
      const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', {
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'http://localhost:3000/callback',
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })

      console.log('req token:', tokenResponse.config)
      console.log('token res:', tokenResponse.data)

      accessToken = tokenResponse.data.access_token
      refreshToken = tokenResponse.data.refresh_token

      console.log(`token recebido: ${accessToken}`)

      // acessa o bot pelo token gerado
      const botResponse = await axios.get('https://discord.com/api/users/@me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      console.log('Bot Information:', botResponse.data)

      // 

      res.send('OAuth2 recebido e confirmado!')
    } catch (error) {
      console.error('OAuth2 token error:', error.message)
      console.error('OAuth2 token erro detalhes:', error.response ? error.response.data : error.request)
      console.error('objeto erro:', error)

      // cuidar do erro, future me
      res.status(500).send('Internal Server Error')
    }
  } else {
    console.error('OAuth2 callback error')
    res.status(400).send('OAuth2 callback error')
  }
})

// express basico
app.listen(PORT, () => {
  console.log(`ouvindo a porta ${PORT}`)
})

const commands = [
  {
    name: 'ping',
    description: 'responde com pong'
  },
  {
    name: 'hello',
    description: 'responde o seu hello'
  },
  {
    name: 'enquete',
    description: 'cria enquete',
    options: [
      {
        name: 'pregunta',
        description: 'uma pergunta válida e inteligente',
        type: 3,
        required: true,
      },
      {
        name: 'respostas',
        description: 'as... respostas (separadas por ponto e vírgula/semicolon/; )',
        type: 3, //3 === STRING
        required: true,
      },
      {
        name: 'chamar_todes',
        description: 'Decide se o bot deve chamar todo mundo para ver sua enquete',
        type: 5, //5 === boolean
        required: false
      }
    ],
  },
]

const rest = new REST({ version: '9' }).setToken(process.env.BOT_TOKEN)

// discord API connect
client.once('ready', async () => {
  console.log('bot esta vivo!')

  //injeta os slash commands necessarios
  try {
    console.log('atualizando (/) comandos.')
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, process.env.SERVER_ID),
      { body: commands },
    )

    console.log('comandos (/) atualizados.')
  } catch (error) {
    console.error('ERRORRRR :::::', error)
  }
})

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return

  // console.log('INICIO INTERACTION :::::', interaction)
  // console.log(':::::: FIM INTERACTION ::::::::')

  const { commandName, options } = interaction


  //silly tests just cause why not
  if (commandName === 'ping') {
    await interaction.reply('Pong!')
  }
  else if (commandName === 'hello') {

    await interaction.reply(`Hello, @${interaction.user.globalName}`)
  }

  // @${ interaction.user.globalName }

  else if (commandName === 'enquete') {
    const questionOption = options.getString('pregunta')
    const optionsOption = options.getString('respostas')
    const chamarTodes = options.getBoolean('chamar_todes') || false

    console.log('pergunta:', questionOption)
    console.log('opções:', optionsOption)

    if (!questionOption || !optionsOption) {
      await interaction.reply('entrada invalida. preencha corretamente.')
      return
    }

    const optionsArray = optionsOption.split(';').map((option) => option.trim())
    console.log('array de opções:', optionsArray)

    if (optionsArray.length < 2) {
      console.log('A enquete deve ter pelo menos duas opções.')
      await interaction.reply('A enquete deve ter pelo menos duas opções.')
      return
    }

    const pollEmbed = {
      color: 0xFF2400,
      title: questionOption,
      description: optionsArray.map((option, index) => `${index + 1}. ${option}`).join('\n'),
      footer: {
        text: 'Reaja para votar!',
      },
    }

    try {
      const reply = await interaction.reply('Enquete sendo processada')

      console.log('Embed:', pollEmbed)

      const pollMessage = await interaction.channel.send({ embeds: [pollEmbed] })

      optionsArray.forEach((_, index) => {
        pollMessage.react(`${index + 1}\u20e3`)
      })

      if (chamarTodes) {
        interaction.channel.send('@everyone, vem votar!')
      }

      await reply.delete()
      console.log("Resposta à interação e mensagem inicial excluídas com sucesso")

    } catch (error) {
      console.error("Erro ao responder à interação:", error)
    }

  }
})

// interaão basica de mensagens
client.on('messageCreate', (message) => {
  if (message.author.bot) return; // ignora bots

  console.log('mensagem recebida :::', message)

})

// Discord API login
client.on('debug', console.log)
client.login(process.env.BOT_TOKEN)


// não vai explodir (eu acho); bom o bastante