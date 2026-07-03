const
Label	= el => {
	let
	$ = `<${ el.localName }>`
	el.id && ( $ += ` #${ el.id }` )
	el.localName === 'text' && ( $ += ` “${ ( el.textContent || '' ).trim().slice( 0, 14 ) }”` )
	return $
}

class TreePanel extends HTMLElement {

	connectedCallback() {
		if	( this.built ) return
		this.built = true
		window.addEventListener( 'doc-changed'			, () => this.Rebuild() )
		window.addEventListener( 'selection-changed'	, () => this.Rebuild() )
	}

	Rebuild() {
		const
		svg = MAIN_EDITOR.SVG()
		if	( !svg ) return
		const
		sel = MAIN_EDITOR.Selected()
		const
		rows = []
		const
		Walk = ( el, depth, ghost ) => {
			const
			row = document.createElement( 'div' )
			row.className			= `tree-row${ sel.includes( el ) ? ' sel' : '' }${ ghost ? ' ghost' : '' }`
			row.style.paddingLeft	= `${ 6 + depth * 12 }px`
			row.textContent			= Label( el )
			row.onclick = ev => ev.shiftKey
				?	MAIN_EDITOR.Select( sel.includes( el ) ? sel.filter( _ => _ !== el ) : [ ...sel, el ] )
				:	MAIN_EDITOR.Select( [ el ] )
			row.onmouseenter	= () => MAIN_EDITOR.SetHover( el )
			row.onmouseleave	= () => MAIN_EDITOR.SetHover( null )
			rows.push( row )
			el.localName === 'text' || [ ...el.children ].forEach(
				_ => Walk( _, depth + 1, ghost || el.localName === 'defs' )
			)
		}
		;[ ...svg.children ].forEach( _ => Walk( _, 0, false ) )
		rows.length || rows.push(
			Object.assign( document.createElement( 'div' ), { className: 'tree-empty', textContent: '( empty document )' } )
		)
		this.replaceChildren( ...rows )
	}
}

customElements.define( 'tree-panel', TreePanel )
