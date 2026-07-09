//	AI-facing command surface for the live, in-browser SVG document.
//
//	Everything here mutates the live <svg> through Application.js. A single
//	apply() call is one undo step and rolls back entirely on any op failure.
//	Exposed as window.EZU ( same design as Zukai's window.ZU ).

import {
	SVG_NS
,	Parse
,	Serialize
,	Mutate
,	SetText
}	from './Application.js'

//	CSS-selector hint for an element ( ids preferred ).
const
SelPath	= el => {
	if	( el.id ) return `#${ el.id }`
	const
	parts = []
	for	( let e = el; e && e !== MAIN_EDITOR.SVG(); e = e.parentNode ) {
		const
		i = [ ...e.parentNode.children ].filter( _ => _.localName === e.localName ).indexOf( e ) + 1
		parts.unshift( `${ e.localName }:nth-of-type(${ i })` )
	}
	return parts.join( ' > ' )
}

const
MatchAll	= ( select, i ) => {
	const
	svg = MAIN_EDITOR.SVG()
	if	( typeof select !== 'string' || !select.trim() )
		throw new Error( `op[${ i }] is missing "select"` )
	if	( select.trim() === 'svg' ) return [ svg ]
	let	els = []
	try {
		els = [ ...svg.querySelectorAll( select ) ]
	} catch {
		throw new Error( `op[${ i }] "${ select }" is not a valid CSS selector` )
	}
	if	( !els.length ) throw new Error( `op[${ i }] "${ select }" matched no element` )
	return els
}

//	Parse an SVG fragment ( one or more elements ) into imported nodes.
const
Fragment	= ( svg, i ) => {
	const
	doc = new DOMParser().parseFromString( `<svg xmlns="${ SVG_NS }">${ svg }</svg>`, 'image/svg+xml' )
	if	( doc.querySelector( 'parsererror' ) )
		throw new Error( `op[${ i }] "svg" fragment does not parse` )
	const
	els = [ ...doc.documentElement.children ].map( _ => document.importNode( _, true ) )
	if	( !els.length ) throw new Error( `op[${ i }] "svg" fragment is empty` )
	return els
}

const
ApplyOp	= ( op, i ) => {
	const
	svg = MAIN_EDITOR.SVG()
	switch ( op.op ) {
	case 'setDoc'	:
		MAIN_EDITOR.SetSVG( Parse( op.svg ) )
		break
	case 'add'		: {
		const
		els = Fragment( op.svg, i )
		const
		parent	= op.parent	? MatchAll( op.parent, i )[ 0 ]	: svg
		const
		before	= op.before	? MatchAll( op.before, i )[ 0 ]	: null
		if	( !parent ) throw new Error( `op[${ i }] parent matched no element` )
		els.forEach( _ => before ? parent.insertBefore( _, before ) : parent.append( _ ) )
		break
	}
	case 'update'	:
		MatchAll( op.select, i ).forEach(
			el => {
				Object.entries( op.attrs || {} ).forEach(
					( [ k, v ] ) => {
						try {
							v == null ? el.removeAttribute( k ) : el.setAttribute( k, v )
						} catch {
							throw new Error( `op[${ i }] cannot set attribute "${ k }"` )
						}
					}
				)
				op.text == null || SetText( el, String( op.text ) )
			}
		)
		break
	case 'remove'	:
		MatchAll( op.select, i ).forEach(
			_ => {
				if	( _ === svg ) throw new Error( `op[${ i }] cannot remove the root <svg>` )
				_.remove()
			}
		)
		break
	case 'restack'	:
		MatchAll( op.select, i ).forEach(
			_ => {
				if	( _ === svg ) throw new Error( `op[${ i }] cannot restack the root <svg>` )
				const
				first = _.parentNode.firstElementChild
				op.toFront === false
					?	( first && first.localName === 'defs' ? first.after( _ ) : _.parentNode.prepend( _ ) )
					:	_.parentNode.append( _ )
			}
		)
		break
	case 'setCanvas':
		if	( !( op.width > 0 ) ) throw new Error( `op[${ i }] setCanvas width must be positive` )
		if	( !( op.height > 0 ) ) throw new Error( `op[${ i }] setCanvas height must be positive` )
		svg.setAttribute( 'width', op.width )
		svg.setAttribute( 'height', op.height )
		op.viewBox && svg.setAttribute( 'viewBox', op.viewBox )
		break
	default			:
		throw new Error( `op[${ i }] has unknown op "${ op?.op }"` )
	}
}

window.EZU	= {
	getSVG		: () => Serialize()
,	getSelection: () => MAIN_EDITOR.Selected().map( SelPath )
	//	One apply() = one undo step. Any op failure rolls the whole batch back
	//	( Mutate restores the pre-batch SVG ) and throws — no partial apply.
,	apply		: ops => {
		if	( !Array.isArray( ops ) ) throw new Error( 'apply expects an array of ops' )
		if	( !ops.length ) throw new Error( 'apply expects a non-empty ops array' )
		Mutate(
			'AI'
		,	() => ops.forEach( ( op, i ) => ApplyOp( op, i ) )
		)
		return []
	}
}
