export	const
dones	= []
export	const
todos	= []

//	Cap the undo history: each entry holds a full serialized SVG string.
const
LIMIT	= 200

export	const
DumpJobs	= () => {
	console.log( '---- todos', todos.length )
	todos.forEach( _ => console.log( _.label ) )
	console.log( '---- dones', dones.length )
	dones.forEach( _ => console.log( _.label ) )
}

export	const
ClearJobs	= () => (
	dones.length = 0
,	todos.length = 0
)

export	const
Undo	= async () => {
	if	( !dones.length ) return
	const
	_ = dones.pop()
	await _.undo()
	todos.push( _ )
}

export	const
Redo	= async () => {
	if	( !todos.length ) return
	const
	_ = todos.pop()
	await _.redo()
	dones.push( _ )
}

//	Push an already-applied mutation: redo/undo closures restore the
//	after / before snapshots. The mutation itself is NOT re-run here so
//	the live DOM (and the current selection) stays intact.
export	default
( label, redo, undo ) => {
	dones.push(
		{	label
		,	redo
		,	undo
		}
	)
	while	( dones.length > LIMIT ) dones.shift()
	todos.length = 0
}
