//	Shared core for the in-app AI assistant panels ( Claude + OpenAI ).
//
//	Provider-neutral: the SVG ops contract, the ops tool schema, the SSE line
//	reader, and the panel UI + tool loop. Each provider module supplies a
//	streamTurn() that talks to its own API and normalizes tool calls to
//	{ id, input }. Edits go through window.EZU.apply ( ai-api.js ), so each
//	apply_ops call is one undo step + redraw. Same design as Zukai.

export const
SYSTEM			= `You edit a live SVG document by calling the apply_ops tool.

The document is a plain <svg>; its current markup is appended below, fresh each request.
Elements are addressed with CSS selectors ( "select" ), e.g. "#sun", "g#tree > rect", "path:nth-of-type(2)". Give new elements an id so you can address them later.

apply_ops ops ( one apply_ops call = one undo step; any op failure rolls the whole batch back ):
  { op:"add",       svg, parent?, before? }    // svg = SVG fragment markup ( one or more elements ); parent / before are selectors ( default: append to root )
  { op:"update",    select, attrs?, text? }    // attrs: { name: value, ... } — null value removes the attribute; text replaces the content of a <text> ( "\\n" makes tspan lines )
  { op:"remove",    select }
  { op:"restack",   select, toFront? }         // default true ( bring to front )
  { op:"setCanvas", width, height, viewBox? }
  { op:"setDoc",    svg }                      // replace the whole document ( full <svg> markup ) — only for big rewrites

Rules:
- Prefer small targeted ops ( update / add / remove ) over setDoc.
- Coordinates are in viewBox user units; the Y axis points down.
- Keep existing ids stable. Never remove or rewrite elements you were not asked to touch.
- If the user says "this" / "the selected one", use the current selection listed below.
- On failure the document is unchanged and the tool returns an error; fix and call apply_ops again.
- When the request is done, reply with a one-line summary of what you changed. Do not ask for confirmation before editing.`

//	JSON schema for the single apply_ops tool ( shared by both providers ).
export const
OPS_SCHEMA		= {
	type		: 'object'
,	properties	: { ops: { type: 'array', items: { type: 'object' } } }
,	required	: [ 'ops' ]
}

//	System prompt with the current live document appended ( fresh every request ).
export const
systemWithModel	= () => {
	const
	sel = window.EZU.getSelection()
	return `${ SYSTEM }

Current document:
${ window.EZU.getSVG() }

Current selection: ${ sel.length ? sel.join( ', ' ) : '( none )' }`
}

//	Read an SSE response, calling onEvent( rawDataString ) per \`data:\` line.
//	Stops on \`data: [DONE]\` ( OpenAI ) or stream end ( Anthropic ).
export const
readSSE			= async ( res, onEvent ) => {
	const
	reader		= res.body.getReader()
	,	decoder		= new TextDecoder
	let	buf			= ''
	for	( ;; ) {
		const	{ value, done } = await reader.read()
		if	( done )	break
		buf += decoder.decode( value, { stream: true } )
		let	i
		while	( ( i = buf.indexOf( '\n\n' ) ) !== -1 ) {
			const
			chunk	= buf.slice( 0, i )
			buf		= buf.slice( i + 2 )
			const	line = chunk.split( '\n' ).find( _ => _.startsWith( 'data:' ) )
			if	( !line )	continue
			const	data = line.slice( 5 ).trim()
			if	( data === '[DONE]' )	return
			onEvent( data )
		}
	}
}

const	MAX_TURNS	= 6		//	guard against runaway tool loops

//	Wire one panel. `provider` supplies element refs, localStorage keys, and the
//	API-specific streamTurn / message threading. See ai-panel.js ( Claude ) and
//	ai-panel-openai.js ( OpenAI ).
export const
initPanel		= provider => {
	const
	{ el, storeKey, storeModel } = provider
	,	setKey		= _ => _ ? localStorage.setItem( storeKey, _ ) : localStorage.removeItem( storeKey )
	,	logLine		= ( role, text ) => {
		const	div = document.createElement( 'div' )
		div.className	= `ai-msg ai-${ role }`
		div.textContent	= text
		el.log.append( div )
		el.log.scrollTop = el.log.scrollHeight
		return	div
	}

	//	restore persisted key / model ( drop stale model ids → first option = latest )
	el.key.value		= localStorage.getItem( storeKey ) || ''
	const
	pickModel	= prefer => {
		const
		ok = prefer && [ ...el.model.options ].some( o => o.value === prefer )
		el.model.value = ok ? prefer : el.model.options[ 0 ]?.value
		el.model.value && localStorage.setItem( storeModel, el.model.value )
	}
	pickModel( localStorage.getItem( storeModel ) )
	el.key.onchange		= () => setKey( el.key.value.trim() )
	el.model.onchange	= () => localStorage.setItem( storeModel, el.model.value )
	el.keyToggle.onclick	= () => el.key.type = el.key.type === 'password' ? 'text' : 'password'
	el.keyClear.onclick		= () => { el.key.value = ''; setKey( '' ); el.key.focus() }

	if	( el.modelFetch && provider.listModels ) {
		el.modelFetch.onclick = async () => {
			const
			key = el.key.value.trim()
			if	( !key ) {
				logLine( 'error', 'Set your API key first ( the key field above ).' )
				return
			}
			setKey( key )
			el.modelFetch.disabled = true
			const
			prev = el.model.value
			try {
				const
				models = await provider.listModels( key )
				if	( !models.length ) throw new Error( 'No chat models returned' )
				el.model.replaceChildren()
				for ( const m of models ) {
					const
					o = document.createElement( 'option' )
					o.value			= m.id
					o.textContent	= m.label || m.id
					el.model.append( o )
				}
				pickModel( prev )
				logLine( 'status', `Loaded ${ models.length } models` )
			} catch ( er ) {
				logLine( 'error', String( er?.message || er ) )
			} finally {
				el.modelFetch.disabled = false
			}
		}
	}

	const
	run			= async () => {
		const	prompt = el.input.value.trim()
		if	( !prompt )	return
		const	key = el.key.value.trim()
		if	( !key ) {
			logLine( 'error', 'Set your API key first ( the key field above ).' )
			return
		}
		setKey( key )

		logLine( 'user', prompt )
		el.input.value	= ''
		el.send.disabled	= true
		let	pending = logLine( 'status', '…thinking' )
		const	clearPending = () => { if ( pending ) { pending.remove(); pending = null } }

		const	messages = provider.initMessages( prompt )
		try {
			for	( let turn = 0; turn < MAX_TURNS; turn++ ) {
				let	liveEl = null
				const	{ assistant, toolCalls } = await provider.streamTurn( key, el.model.value, messages, {
					onTextStart	: () => { clearPending(); liveEl = logLine( 'assistant', '' ) }
				,	onTextDelta	: full => { if ( liveEl ) { liveEl.textContent = full; el.log.scrollTop = el.log.scrollHeight } }
				} )

				if	( !toolCalls.length )	break

				messages.push( assistant )

				//	run every requested apply_ops and feed results back
				const	results = []
				for	( const tc of toolCalls ) {
					let		content
					try {
						const	ops = tc.input?.ops ?? []
						const	issues = window.EZU.apply( ops )
						content = JSON.stringify( { applied: ops.length, issues } )
					} catch ( er ) {
						content = JSON.stringify( { error: String( er?.message || er ) } )
					}
					results.push( { id: tc.id, content } )
				}
				messages.push( ...provider.toolResultMessages( results ) )
			}
		} catch ( er ) {
			logLine( 'error', String( er?.message || er ) )
		} finally {
			clearPending()
			el.send.disabled = false
		}
	}

	el.send.onclick	= run
	el.input.onkeydown = ev => {
		//	Enter sends, Shift+Enter inserts a newline
		if	( ev.key === 'Enter' && !ev.shiftKey ) { ev.preventDefault(); void run() }
	}
}
