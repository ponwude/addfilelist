const fs = require('then-fs')
const path = require('path')


function node(str, parent=null) {
  this.parent = parent
  this.str = str
  this.children = []
}

node.prototype.get_root = function() {
  if (this.parent === null) return this
  return this.parent.get_root()
}

node.prototype.add_child = function(str) {
  if (this.in_bloodline(str))
    throw new Error(`Root node of ${this.str} already constains ${str}.`)

  const child = new node(str, this)
  this.children.push(child)
  return child
}

node.prototype.add_child_node = function(node) {
  if (node.parent !== null)
    throw new Error(`Child "${node.str}" already has parent "${node.parent.str}"`)

  if (this.in_bloodline(node))
    throw new Error(`Root node of ${this.str} already constains ${node.str}.`)

  node.parent = this
  this.children.push(node)
  return this
}

node.prototype.in_bloodline = function(ancestor) {
  if (ancestor instanceof node) ancestor = ancestor.str

  if (this.str === ancestor) return true
  if (this.parent === null) return false
  return this.parent.in_bloodline(ancestor)
}

node.prototype.is_ancestor_of = function(str) {
  if (str instanceof node) str = str.str
  if (this.children.some(child => child.str === str)) return true
  return this.children.some(child => child.is_ancestor_of(str))
}

node.prototype.contains = function(str) {
  if (str instanceof node) str = str.str
  return this.str === str || this.is_ancestor_of(str)
}

node.prototype.root_contains = function(str) {
  return this.get_root().contains(str)
}

node.prototype.num_nodes = function() {
  return 1 + this.children.reduce((t, c) => t + c.num_nodes(), 0)
}

node.prototype.flatten = function(container=[]) {
  container.push(this.str)
  this.children.forEach(c => {c.flatten(container)})

  return container
}

node.prototype.to_string = function(indent=0) {
  const strings = []

  const start = `${' '.repeat(indent)}${this.str}`
  if (this.children.length > 0) {
    strings.push(start + `: ${this.children.map(c => c.str).join(', ')}\n`)

    this.children.forEach(c => {
      strings.push(c.to_string(indent + 2))
    })
  }
  else
    strings.push(start + ' -\n')

  return strings.join('')
}


async function dependency_tree(entry_file, options={}) {
  const {parent, max_depth=100, depth=0} = options

  if (depth > max_depth) throw new Error(`Max depth of ${max_depth} exceded.`)

  const entry_file_full = path.resolve(entry_file),
        entry_dir = path.dirname(entry_file_full)

  try { await fs.access(entry_file_full) } catch(err) {throw err}

  const [file_node, root_node] = (function() {
    if (parent === undefined) {
      const file_node = new node(entry_file_full)
      return [file_node, file_node]
    }

    try {
      return [parent.add_child(entry_file_full), options.root_node]
    } catch(err) {
      throw new Error(`Found circular dependency for ${entry_file_full} with root node of ${parent.get_root().str}.`)
    }

  })()

  const re = /\brequire\(\w*['"`](.*\.js)['"`]\w*\)/g

  try {
    const file_str = await fs.readFile(entry_file_full)

    let dependency = undefined
    while ((dependency = re.exec(file_str)) !== null) {
      const dep_path = path.join(entry_dir, dependency[1]) // file path
      await dependency_tree(dep_path, {
        root_node,
        parent: file_node,
        max_depth,
        depth: depth + 1,
      })
    }
  } catch(err) {throw err}

  return file_node
}


/* dep_trees - Array of trees from dependency_tree
 */
function sort_test_order(dep_trees) {
  const over_dep_order = dep_trees.map(t => t.str)
  const over_dep_trees = {}
  over_dep_order.forEach(t => over_dep_trees[t] = new node(t))

  for (let i1 = dep_trees.length - 1; i1 >= 1; --i1) {
    const t1 = dep_trees[i1]

    for (let i2 = i1 - 1; i2 >= 0; --i2) {
      const t2 = dep_trees[i2]

      const child_loop = function(ancestor, descendant) {
        for (let ci = descendant.children.length - 1; ci >= 0; --ci) {
          const descendant_entry = descendant.children[ci].str

          if (ancestor.is_ancestor_of(descendant_entry)) {
            try {
              over_dep_trees[ancestor.str].add_child_node(over_dep_trees[descendant.str])
            } catch(err) {
              break
            }
            break
          }
        }
      }

      child_loop(t1, t2)
      child_loop(t2, t1)
    }
  }

  over_dep_order.sort((a, b) => {
    const an = over_dep_trees[a],
          bn = over_dep_trees[b]
    const a_in_b = bn.is_ancestor_of(a),
          b_in_a = an.is_ancestor_of(b)

    let to_return
    if (a_in_b && b_in_a){
      const a_num = an.num_nodes(), b_num = bn.num_nodes()
      if (a_num < b_num) to_return = -1
      else if (b_num < a_num) to_return = 1
      else to_return = 0
    }
    else if (a_in_b) to_return = -1
    else if (b_in_a) to_return = 1
    else {
      const a_num = an.num_nodes(), b_num = bn.num_nodes()
      if (a_num < b_num) to_return = -1
      else if (b_num < a_num) to_return = 1
      else {
        const index_map = dep_trees.map(t => t.str)
        const an = dep_trees[index_map.indexOf(a)],
              bn = dep_trees[index_map.indexOf(b)]
        const a_num = an.num_nodes(), b_num = bn.num_nodes()
        if (a_num < b_num) to_return = -1
        else if (b_num < a_num) to_return = 1
        else to_return = 0
      }
    }

    return to_return
  })

  return over_dep_order
}


module.exports = {
  node,
  dependency_tree,
  sort_test_order,
}
