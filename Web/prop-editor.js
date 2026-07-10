import {
	STORAGE_KEY
,	Serialize
,	Commit
,	GetText
,	SetText
,	CaptureSelection
}	from './Application.js'

const
DEFAULTS_KEY	= `${ STORAGE_KEY }.defaults`

const
FALLBACK	= {
	fill			: '#60a5fa'
,	stroke			: '#1e3a8a'
,	'stroke-width'	: '2'
,	opacity			: ''
,	'font-size'		: '16'
}

const
DEFAULT_FIELDS	= [ 'fill', 'stroke', 'stroke-width', 'opacity', 'font-size' ]

const
LoadDefaults	= () => {
	try {
		return { ...FALLBACK, ...JSON.parse( localStorage.getItem( DEFAULTS_KEY ) ) }
	} catch {
		return { ...FALLBACK }
	}
}

const
HEX	= /^#[0-9a-fA-F]{6}$/

class PropEditor extends HTMLElement {

	connectedCallback() {
		if	( this.built ) return
		this.built		= true
		this.el			= null
		this.before		= null
		this.defaults	= LoadDefaults()
		this.innerHTML	= `
	<div><span>element</span><span class=prop-tag>—</span></div>
	<div class=only-el><span>id</span><input data-attr=id spellcheck=false autocomplete=off></div>
	<div><span>fill</span><span class=color-pair><input data-attr=fill spellcheck=false autocomplete=off><input type=color data-color=fill></span></div>
	<div><span>stroke</span><span class=color-pair><input data-attr=stroke spellcheck=false autocomplete=off><input type=color data-color=stroke></span></div>
	<div><span>stroke-width</span><input data-attr=stroke-width type=number min=0 step=.5></div>
	<div><span>opacity</span><input data-attr=opacity type=number min=0 max=1 step=.05></div>
	<div><span>font-size</span><input data-attr=font-size type=number min=1></div>
	<div class="prop-block prop-text only-el"><div>text</div><textarea data-text rows=2></textarea></div>
	<div class="prop-block prop-d only-el"><div>path d ( live preview )</div><textarea data-d rows=5 spellcheck=false></textarea></div>
	<div class="prop-block only-el"><div>attributes ( name = value, one per line )</div><textarea data-attrs rows=7 spellcheck=false></textarea></div>
`
		this.addEventListener( 'focusin'	, () => {
			if	( this.before != null ) return
			this.before		= Serialize()
			this.beforeSel	= CaptureSelection()
		} )
		this.addEventListener( 'input'		, ev => this.Input( ev ) )
		this.addEventListener( 'change'		, ev => this.Change( ev ) )
		window.addEventListener( 'selection-changed'	, () => this.SyncSel() )
		window.addEventListener( 'doc-changed'			, () => this.contains( document.activeElement ) || this.SyncSel() )
	}

	Defaults() { return this.defaults }

	SyncSel() {
		this.el		= MAIN_EDITOR.Selected()[ 0 ] || null
		this.before	= null
		this.beforeSel	= null
		this.Sync()
	}

	Sync() {
		const
		el = this.el
		const
		n = MAIN_EDITOR.Selected().length
		this.classList.toggle( 'defaults', !el )
		this.querySelector( '.prop-tag' ).textContent = el
			?	`<${ el.localName }>${ n > 1 ? `  +${ n - 1 } more` : '' }`
			:	'( defaults for new shapes )'
		this.querySelectorAll( '[data-attr]' ).forEach(
			_ => {
				const
				a = _.dataset.attr
				_.value = el
					?	el.getAttribute( a ) ?? ''
					:	a === 'id' ? '' : this.defaults[ a ] ?? ''
			}
		)
		this.querySelectorAll( '[data-color]' ).forEach(
			_ => {
				const
				v = el ? el.getAttribute( _.dataset.color ) : this.defaults[ _.dataset.color ]
				HEX.test( v || '' ) && ( _.value = v )
			}
		)
		const
		textRow = this.querySelector( '.prop-text' )
		textRow.style.display = el?.localName === 'text' ? '' : 'none'
		el?.localName === 'text' && ( textRow.querySelector( 'textarea' ).value = GetText( el ) )
		const
		dRow = this.querySelector( '.prop-d' )
		dRow.style.display = el?.localName === 'path' ? '' : 'none'
		el?.localName === 'path' && ( dRow.querySelector( 'textarea' ).value = el.getAttribute( 'd' ) ?? '' )
		this.querySelector( '[data-attrs]' ).value = el
			?	[ ...el.attributes ].map( _ => `${ _.name } = ${ _.value }` ).join( '\n' )
			:	''
	}

	Input( ev ) {
		const
		t = ev.target
		//	`d` previews live, keystroke by keystroke; commit happens on change.
		if	( t.dataset.d != null ) {
			this.el && (
				this.el.setAttribute( 'd', t.value )
			,	MAIN_EDITOR.Draw()
			)
			return
		}
		let
		attr = t.dataset.attr
		if	( t.dataset.color != null ) {
			attr = t.dataset.color
			const
			txt = this.querySelector( `[data-attr="${ attr }"]` )
			txt && ( txt.value = t.value )
		}
		if	( attr == null ) return		//	textareas apply on change only
		if	( !this.el ) {
			DEFAULT_FIELDS.includes( attr ) && (
				this.defaults[ attr ] = t.value
			,	localStorage.setItem( DEFAULTS_KEY, JSON.stringify( this.defaults ) )
			)
			return
		}
		t.value === ''
			?	this.el.removeAttribute( attr )
			:	this.el.setAttribute( attr, t.value )
		MAIN_EDITOR.Draw()
	}

	Change( ev ) {
		if	( !this.el ) return void ( this.before = null, this.beforeSel = null )
		const
		t = ev.target
		t.dataset.attrs	== null || this.ApplyAttrs( t.value )
		t.dataset.text	== null || SetText( this.el, t.value )
		const
		before = this.before
		,	beforeSel = this.beforeSel ?? []
		this.before = null
		this.beforeSel = null
		before == null || Commit( 'Props', before, beforeSel )
	}

	ApplyAttrs( text ) {
		const
		el = this.el
		const
		want = {}
		text.split( '\n' ).forEach(
			_ => {
				const
				i = _.indexOf( '=' )
				if	( i < 1 ) return
				const
				k = _.slice( 0, i ).trim()
				k && ( want[ k ] = _.slice( i + 1 ).trim() )
			}
		)
		;[ ...el.attributes ].forEach( _ => _.name in want || el.removeAttribute( _.name ) )
		Object.entries( want ).forEach( ( [ k, v ] ) => { try { el.setAttribute( k, v ) } catch {} } )
		MAIN_EDITOR.Draw()
	}
}

customElements.define( 'prop-editor', PropEditor )
