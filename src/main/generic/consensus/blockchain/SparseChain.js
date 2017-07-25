/**
 * A rooted, sparse chain of light blocks.
 * TODO Compress block tree Patricia-style for efficient totalWork updates.
 */
class SparseChain extends Observable {
    /**
     * @param {BlockStore} store
     * @returns {Promise.<SparseChain>}
     */
    constructor(store) {
        super();
        this._store = store;

        /** @type {Block} */
        this._head = Block.GENESIS;
        /** @type {Hash} */
        this._headHash = Block.GENESIS.HASH;

        /** @type {number} */
        this._totalWork = Block.GENESIS.difficulty;

        /** @type {HashMap.<Hash, BlockData>} */
        this._blockData = new HashMap();

        // Initialize genesis data.
        const genesisData = new BlockData(null, /*TODO real work*/, true);
        this._blockData.put(Block.GENESIS.HASH, genesisData);

        /**
         * Map from block hash to HashSet of all blocks in this chain which reference the key hash in its interlink.
         * @type {HashMap.<Hash, HashSet.<Hash>>}
         */
        this._interlinkIndex = new HashMap();

        return Promise.resolve(this);
    }

    /** Public API **/

    /**
     * NOT SYNCHRONIZED! Callers must ensure synchronicity.
     * Assumes that the given block is verified!
     * @param {Block} block A *verified* block
     * @returns {Promise.<number>}
     * @private
     */
    async append(block) {
        // Check if the given block is already part of this chain.
        const hash = await block.hash();
        if (this._blockData.contains(hash)) {
            return SparseChain.ACCEPTED;
        }

        // Find the closest interlink predecessor of the given block in this chain.
        /** @type {Block} */
        const predecessor = await this._getPredecessor(block);
        if (!predecessor) {
            Log.w(SparseChain, 'Rejected block - no predecessor found');
            return SparseChain.REJECTED;
        }

        // Check that the block is a valid successor (immediate or interlink) of its predecessor.
        if (!(await block.isSuccessorOf(predecessor))) {
            Log.w(SparseChain, 'Invalid block - not a valid successor');
            return SparseChain.REJECTED;
        }

        // Check that the block's prevHash and interlink are consistent with the main chain: Look at each block in the interlink
        // starting at the lowest depth (i = 1). If a block is found that is on the main chain, all subsequent blocks must
        // be on the main chain as well. If a block is found that is not on the main chain, the given block cannot
        // be on the main chain.
        let metMainChain = false;
        let succeedsMainChain = true;
        for (const hash of [block.prevHash, ...block.interlink.hashes.slice(1)]) {
            const data = this._blockData.get(hash);
            if (data) {
                metMainChain |= data.onMainChain;
                succeedsMainChain &= data.onMainChain;

                if (metMainChain && !data.onMainChain) {
                    // An earlier interlink predecessor was on the main chain, this one isn't. Something is wrong with this block.
                    Log.w(SparseChain, 'Rejected block - inconsistent interlink/main chain');
                    return SparseChain.REJECTED;
                }
            }
        }

        // TODO Verify that interlink construction for block b is valid by looking at the closest predecessor and closest successor.

        // The block looks valid. Make sure that the chain is consistent with it.
        await this._truncateInconsistentBlocks(block, succeedsMainChain);




        // Several possible insert positions:
        // 1. Successor of the current main head
        const prevHash = await predecessor.hash();
        if (prevHash.equals(this._headHash)) {
            // Append new block to the main chain.
            await this._extend(block);

            // Tell listeners that the head of the chain has changed.
            this.fire('head-changed', this._head);

            return SparseChain.EXTENDED;
        }

        // 2. Inner block of the main chain
        else if (onMainChain) {
            // Recompute totalWork values

            return SparseChain.ACCEPTED;
        }

        // 3. Inner block of a fork
        else if (references && references.length > 0) {
            // Recompute totalWork values
            // TODO might rebranch
        }

        // 4. Successor of a fork head
        else {
            // TODO might rebranch
        }


        // We only want interlink blocks in this chain.
        // When advancing the head, remove any blocks that are not referenced in any interlink.


        // Block looks good, compute totalWork and create BlockData.

        /** @type {BlockData} */
        const prevData = this._blockData.get(prevHash);
        const totalWork = prevData.totalWork + block.difficulty;
        const blockData = new BlockData(prevHash, totalWork);
        prevData.successors.add(hash);
        this._blockData.put(hash, blockData);

        // Add block to interlink index.
        await this._index(block);


        // Otherwise, check if the totalWork of the block is harder than our current main chain.
        if (totalWork > this._headData.totalWork) {
            // A fork has become the hardest chain, rebranch to it.
            await this._rebranch(block);

            // Tell listeners that the head of the chain has changed.
            this.fire('head-changed', this.head);

            return true;
        }

        // Otherwise, we are creating/extending a fork. We have stored the block,
        // the head didn't change, nothing else to do.
        Log.v(Blockchain, `Creating/extending fork with block ${hash.toBase64()}, height=${block.height}, totalWork=${blockData.totalWork}`);

        return true;
    }


    /**
     * @param {Block} block
     * @param {boolean} succeedsMainChain
     * @returns {Promise.<void>}
     */
    async _truncateInconsistentBlocks(block, succeedsMainChain) {
        const hash = await block.hash();

        // If there are no blocks in this chain that reference the given block, nothing to do.
        /** @type {HashSet.<Hash>} */
        const references = this._interlinkIndex.get(hash);
        if (!references) {
            return Promise.resolve();
        }

        // Check that all blocks in this chain that reference the given block in their interlink
        // are valid interlink successors to the given block.
        for (const refHash of references.values()) {
            /** @type {Block} */
            const refBlock = await this._store.get(refHash.toBase64()); // eslint-disable-line no-await-in-loop
            // XXX Assert that the referenced block is there.
            if (!refBlock) throw 'Failed to retrieve interlink reference from store';

            if (!(await refBlock.isInterlinkSuccessorOf(block))) { // eslint-disable-line no-await-in-loop
                Log.w(SparseChain, `Inconsistent interlink found, truncating ${refHash}`);

                // We found a block with an inconsistent interlink that looked good when we added it to the chain
                // because we didn't know the referenced (given) interlink block at that time. Cut off the bad block
                // and all its successors.
                await this._truncate(refBlock, /*preserveMainChain*/ false, /*removeFromStore*/ true); // eslint-disable-line no-await-in-loop

                // We have cut the bad part from the chain. Abort loop and start from the beginning.
                return this._truncateInconsistentBlocks(block);
            }
        }

        // Check that the main chain is consistent: If block is succeeded by at least one block that is on the main
        // chain, the block must be a successor to the main chain and not be on a fork. If the block is on a fork, the
        // main chain is inconsistent ... TODO what happens now?
        // TODO Check fork consistency as well somehow?
        const onMainChain = references.values().some(hash => {
            const data = this._blockData.get(hash);
            return data && data.onMainChain;
        });
        if (onMainChain && !succeedsMainChain) {
            // TODO ...
        }

        return Promise.resolve();
    }













    /** Private API **/

    /**
     * @param {Block} block
     * @returns {Promise.<void>}
     * @private
     */
    async _rebranch(block) {
        // Find the common ancestor between our current main chain and the fork chain.
        // Walk up the fork chain until we find a block that is part of the main chain.
        // Store the chain along the way. Rebranching fails if we reach the tail of the chain.
        const forkChain = [block];
        let forkHead = block;
        let prevData = this._blockData.get(forkHead.prevHash);
        while (!prevData.onMainChain) {
            forkHead = await this._store.get(forkHead.prevHash.toBase64()); // eslint-disable-line no-await-in-loop
            // XXX Assert that the block is there.
            if (!forkHead) throw 'Corrupted store: Failed to find predecessor while rebranching'

            // Build the fork chain in reverse order for efficiency.
            forkChain.push(forkHead);

            prevData = this._blockData.get(forkHead.prevHash);
            if (!prevData) throw 'Reached tail of chain while rebranching';
        }

        // The predecessor of forkHead is the desired common ancestor.
        const commonAncestor = forkHead.prevHash;

        Log.v(Blockchain, `Found common ancestor ${commonAncestor.toBase64()} ${forkChain.length} blocks up`);

        // Revert all blocks on the current main chain until the common ancestor.
        await this._revertTo(commonAncestor);

        // We have reverted to the common ancestor state. Extends the main chain with all blocks from forkChain.
        // TODO With light blocks, we don't actually need to load the blocks from storage and apply them one-by-one. Just fast-forward the head.
        for (let i = forkChain.length - 1; i >= 0; i++) {
            await this._extend(forkChain[i]); // eslint-disable-line no-await-in-loop
        }
    }

    /**
     * Extends the main chain with the given block.
     * @param {Block} block
     * @returns {Promise.<void>}
     * @private
     */
    async _extend(block) {
        // Update head block & total work.
        this._head = block;
        this._headHash = await block.hash();
        this._totalWork += block.difficulty;

        // Mark the block as part of the main chain.
        // Must be done AFTER updating _headHash.
        this._headData.onMainChain = true;

        // If the chain has grown too large, evict the tail block.
        if (this.length > DenseChain.MAX_LENGTH) {
            await this._shift();
        }
    }

    /**
     * Reverts the head of the main chain to the block specified by blockHash, which must be on the main chain.
     * @param {Hash} blockHash
     * @returns {Promise.<void>}
     * @private
     */
    async _revertTo(blockHash) {
        // Cannot revert if we are at the beginning of the chain.
        // TODO Should be attempt to load further blocks from storage?
        if (this.length === 1) {
            throw 'Cannot revert chain past initial block';
        }

        // XXX Sanity check: Validate that the blockHash is known and on the main chain.
        const blockData = this._blockData.get(blockHash);
        if (!blockData || !blockData.onMainChain) throw 'Illegal blockHash - unknown or not on main chain';

        // Mark all blocks up to blockHash as not on the main chain anymore.
        // Also compute the sum of totalWork that we are reverting.
        // TODO Instead of summing up here, we could also compute this from the BlockData totalWork values.
        let hash = this.headHash;
        let totalWork = 0;
        while (!hash.equals(blockHash)) {
            /** @type {BlockData} */
            const data = this._blockData.get(hash);
            data.onMainChain = false;
            totalWork += data.totalWork;

            hash = data.predecessor;
        }

        // Update head block & totalWork.
        this._head = await this._store.get(blockHash);
        // XXX Assert that the block is there.
        if (!this._head) throw 'Corrupted store: Failed to load block while reverting';
        this._headHash = blockHash;
        this._totalWork -= totalWork;
    }

    /**
     * Removes startBlock and its successors from this chain. If preserveMainChain is set to true, only
     * blocks that are not on the main chain will be removed. If removeFromStore is set to true, removed
     * blocks will also be deleted from storage.
     * @param {Block} startBlock
     * @param {boolean} preserveMainChain
     * @param {boolean} removeFromStore
     * @returns {Promise.<void>}
     * @private
     */
    async _truncate(startBlock, preserveMainChain = true, removeFromStore = false) {
        const deleteSubTree = async /** @type {Hash} */ blockHash => {
            /** @type {BlockData} */
            const blockData = this._blockData.get(blockHash);

            // Recursively delete all subtrees.
            for (/** @type {Hash} */ const succHash of blockData.successors.values()) {
                await deleteSubTree(succHash); // eslint-disable-line no-await-in-loop
            }

            // Don't remove blocks on the main chain if preserveMainChain is set.
            if (blockData.onMainChain && preserveMainChain) {
                return;
            }

            /** @type {Block} */
            const block = await this._store.get(blockHash);
            // XXX Assert that the block is there.
            if (!block) throw 'Corrupted store: Failed to load block while truncating';

            // Unindex and remove block data.
            await this._unindex(block);
            this._blockData.remove(blockHash);

            // Delete from storage if removeFromStore is set.
            if (removeFromStore) {
                await this._store.remove(blockHash);
            }
        };

        // Remove startBlock and its successors recursively.
        const startHash = await startBlock.hash();
        await deleteSubTree(startHash);

        // If we have removed the tail of the chain (and did not preserve the main chain), the chain collapses.
        if (startHash.equals(this.tailHash) && !preserveMainChain) {
            this._destroy();
            return;
        }

        // Update the main chain if preserveMainChain is not set.
        if (!preserveMainChain) {
            // Set the head to the bad block's predecessor.
            this._headHash = startBlock.prevHash;
            this._head = await this._store.get(this._headHash.toBase64());
            // XXX Assert that the block is there.
            if (!this._head) throw 'Failed to retrieve new head block from store';
        }
    }

    /**
     *
     * @param {Block} block
     * @returns {Promise.<Block|null>}
     * @private
     */
    async _getPredecessor(block) {
        // If there is only the genesis block in the interlink, the block must be between the genesis block
        // and the first block in the interlink chain. Return the genesis block in this case.
        if (block.interlink.length === 1) {
            return Block.GENESIS;
        }

        // Try to find a known block referenced in the interlink, starting from the easiest block.
        // XXX We currently explicitly only look at blocks that we hold in memory.
        /** @type {Block} */
        let predecessor = null;
        let i = 1;
        do {
            const hash = block.interlink[i++];
            if (!this._blockData.contains(hash)) {
                continue;
            }
            predecessor = await this._store.get(hash.toBase64()); // eslint-disable-line no-await-in-loop
        } while (!predecessor && i < block.interlink.length);

        // TODO If we don't find predecessor in memory, there might be one in storage. Materialize it.

        // Return the predecessor or null if none was found.
        return predecessor;
    }


    /**
     * Adds the given block to the interlink index.
     * @param {Block} block
     * @returns {Promise.<void>}
     * @private
     */
    async _index(block) {
        // TODO We don't need to index the genesis block.
        const hash = await block.hash();
        for (const reference of [block.prevHash, ...block.interlink]) {
            /** @type HashSet.<Hash> **/
            let set = this._interlinkIndex.get(reference);
            if (!set) {
                set = new HashSet();
            }
            set.add(hash);
        }
    }

    /**
     * Removes the given block from the interlink index.
     * @param {Block} block
     * @returns {Promise.<void>}
     * @private
     */
    async _unindex(block) {
        const hash = await block.hash();
        // TODO We don't need to index the genesis block.
        for (const reference of [block.prevHash, ...block.interlink]) {
            /** @type HashSet.<Hash> **/
            const set = this._interlinkIndex.get(reference);
            if (set) {
                set.remove(hash);
            }
        }
    }

    /**
     * @returns {void}
     * @private
     */
    _destroy() {
        this._totalWork = 0;

        // Free memory.
        this._head = null;
        this._headHash = null;
        this._blockData = null;
        this._interlinkIndex = null;
    }

    /** @type {Block} */
    get head() {
        return this._head;
    }

    /** @type {Hash} */
    get headHash() {
        return this._headHash;
    }

    /**
     * @type {BlockData}
     * @private
     */
    get _headData() {
        return this._blockData.get(this._headHash);
    }

    /** @type {number} */
    get length() {
        return this._hasCollapsed ? 0 : this._head.height - this._tail.height + 1;
    }

    /** @type {number} */
    get totalWork() {
        return this._totalWork;
    }
}
SparseChain.REJECTED = 0;
SparseChain.ACCEPTED = 1;
SparseChain.EXTENDED = 2;
SparseChain.TRUNCATED = -1;
Class.register(SparseChain);
