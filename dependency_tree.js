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
  if (str instanceof node) str = str.str //eslint-disable-line prefer-destructuring
  if (this.children.some(child => child.str === str)) return true
  return this.children.some(child => child.is_ancestor_of(str))
}

node.prototype.contains = function(str) {
  if (str instanceof node) str = str.str //eslint-disable-line prefer-destructuring
  return this.str === str || this.is_ancestor_of(str)
}

node.prototype.root_contains = function(str) {
  return this.get_root().contains(str)
}

// node.prototype.shares_subtree = function(node) {

// }

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


function sort_test_order(src_deptree) {
  const over_dep_order = Object.keys(src_deptree)
  const over_dep_trees = {}
  over_dep_order.forEach(t => over_dep_trees[t] = new node(t))

  for (let i1 = over_dep_order.length - 1; i1 >= 1; --i1) {
    const label_1 = over_dep_order[i1]
    const {src: src1, deptree: dt1} = src_deptree[label_1]

    for (let i2 = i1 - 1; i2 >= 0; --i2) {
      const label_2 = over_dep_order[i2]
      const {src: src2, deptree: dt2} = src_deptree[label_2]

      const dt1_con_src2 = dt1.is_ancestor_of(src2),
            dt2_con_src1 = dt2.is_ancestor_of(src1)

      if (dt1_con_src2 && dt2_con_src1)
        continue
      else if (dt1_con_src2)
        over_dep_trees[label_1].add_child_node(over_dep_trees[label_2])
      else if (dt2_con_src1)
        over_dep_trees[label_2].add_child_node(over_dep_trees[label_1])
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
      // console.log(path.basename(a), '---', path.basename(b))
      const a_num = an.num_nodes(), b_num = bn.num_nodes()
      if (a_num < b_num) to_return = -1
      else if (b_num < a_num) to_return = 1
      else {
        const a_num = src_deptree[a].deptree.num_nodes(),
              b_num = src_deptree[b].deptree.num_nodes()
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
