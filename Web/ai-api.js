//	AI-facing command surface for the live, in-browser SVG document.
//
//	Everything here mutates the live <svg> through Application.js so each
//	apply() call is a single undo step and triggers a redraw. Exposed as
//	window.EZU so an external agent can read and edit the document directly
//	( same design as Zukai's window.ZU ).

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
MatchAll	= ( select, issues, i ) => {
	const
	svg = MAIN_EDITOR.SVG()
	if	( typeof select !== 'string' || !select.trim() ) {
		issues.push( `op[${ i }] is missing "select"` )
		return []
	}
	if	( select.trim() === 'svg' ) return [ svg ]
	let	els = []
	try {
		els = [ ...svg.querySelectorAll( select ) ]
	} catch {
		issues.push( `op[${ i }] "${ select }" is not a valid CSS selector` )
		return []
	}
	els.length || issues.push( `op[${ i }] "${ select }" matched no element` )
	return els
}

//	Parse an SVG fragment ( one or more elements ) into imported nodes.
const
Fragment	= ( svg, issues, i ) => {
	const
	doc = new DOMParser().parseFromString( `<svg xmlns="${ SVG_NS }">${ svg }</svg>`, 'image/svg+xml' )
	if	( doc.querySelector( 'parsererror' ) ) {
		issues.push( `op[${ i }] "svg" fragment does not parse` )
		return []
	}
	const
	els = [ ...doc.documentElement.children ].map( _ => document.importNode( _, true ) )
	els.length || issues.push( `op[${ i }] "svg" fragment is empty` )
	return els
}

const
ApplyOp	= ( op, issues, i ) => {
	const
	svg = MAIN_EDITOR.SVG()
	switch ( op.op ) {
	case 'setDoc'	:
		try {
			MAIN_EDITOR.SetSVG( Parse( op.svg ) )
		} catch ( er ) {
			issues.push( `op[${ i }] setDoc: ${ er.message }` )
		}
		break
	case 'add'		: {
		const
		els = Fragment( op.svg, issues, i )
		if	( !els.length ) break
		const
		parent	= op.parent	? MatchAll( op.parent, issues, i )[ 0 ]	: svg
		const
		before	= op.before	? MatchAll( op.before, issues, i )[ 0 ]	: null
		parent && els.forEach( _ => before ? parent.insertBefore( _, before ) : parent.append( _ ) )
		break
	}
	case 'update'	:
		MatchAll( op.select, issues, i ).forEach(
			el => {
				Object.entries( op.attrs || {} ).forEach(
					( [ k, v ] ) => {
						try {
							v == null ? el.removeAttribute( k ) : el.setAttribute( k, v )
						} catch {
							issues.push( `op[${ i }] cannot set attribute "${ k }"` )
						}
					}
				)
				op.text == null || SetText( el, String( op.text ) )
			}
		)
		break
	case 'remove'	:
		MatchAll( op.select, issues, i ).forEach( _ => _ === svg ? issues.push( `op[${ i }] cannot remove the root <svg>` ) : _.remove() )
		break
	case 'restack'	:
		MatchAll( op.select, issues, i ).forEach(
			_ => {
				if	( _ === svg ) return issues.push( `op[${ i }] cannot restack the root <svg>` )
				const
				first = _.parentNode.firstElementChild
				op.toFront === false
					?	( first && first.localName === 'defs' ? first.after( _ ) : _.parentNode.prepend( _ ) )
					:	_.parentNode.append( _ )
			}
		)
		break
	case 'setCanvas':
		op.width > 0	? svg.setAttribute( 'width', op.width )	: issues.push( `op[${ i }] setCanvas width must be positive` )
		op.height > 0	? svg.setAttribute( 'height', op.height )	: issues.push( `op[${ i }] setCanvas height must be positive` )
		op.viewBox && svg.setAttribute( 'viewBox', op.viewBox )
		break
	default			:
		issues.push( `op[${ i }] has unknown op "${ op?.op }"` )
	}
}

window.EZU	= {
	getSVG		: () => Serialize()
,	getSelection: () => MAIN_EDITOR.Selected().map( SelPath )
,	apply		: ops => {
		const
		issues = []
		Array.isArray( ops ) || ( ops = [] )
		ops.length || issues.push( 'no ops given' )
		Mutate(
			'AI'
		,	() => ops.forEach(
				( op, i ) => {
					try {
						ApplyOp( op, issues, i )
					} catch ( er ) {
						issues.push( `op[${ i }]: ${ String( er?.message || er ) }` )
					}
				}
			)
		)
		return issues
	}
}
