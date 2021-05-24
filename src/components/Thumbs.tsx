import React, { Component, Children, RefObject } from 'react';
import klass from '../cssClasses';
import { outerWidth } from '../dimensions';
import CSSTranslate from '../CSSTranslate';
// @ts-ignore
import Swipe from 'react-easy-swipe';
import getWindow from '../shims/window';
import { Button } from '@material-ui/core';
import AddPhotoAlternateIcon from '@material-ui/icons/AddPhotoAlternate';
import DeleteIcon from '@material-ui/icons/Delete';

const isKeyboardEvent = (e: React.MouseEvent | React.KeyboardEvent): e is React.KeyboardEvent =>
    e.hasOwnProperty('key');

export interface Props {
    axis: 'horizontal' | 'vertical';
    children: React.ReactChild[];
    labels: {
        leftArrow: string;
        rightArrow: string;
        item: string;
    };
    onSelectItem: (index: number, item: React.ReactNode) => void;
    selectedItem: number;
    thumbWidth: number;
    transitionTime: number;
    editMode?: boolean;
    onPhotoRemove?: (photoIndex: number) => void;
    onPhotoAdd?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

interface State {
    selectedItem: number;
    firstItem: number;
    itemSize?: number;
    visibleItems: number;
    lastPosition: number;
    showArrows: boolean;
    swiping: boolean;
}

export default class Thumbs extends Component<Props, State> {
    private itemsWrapperRef?: HTMLDivElement;
    private itemsListRef?: HTMLUListElement;
    private thumbsRef?: HTMLLIElement[];
    private imageInputRef: RefObject<HTMLInputElement> = React.createRef();

    static displayName = 'Thumbs';

    static defaultProps = {
        axis: 'horizontal',
        labels: {
            leftArrow: 'previous slide / item',
            rightArrow: 'next slide / item',
            item: 'slide item',
        },
        selectedItem: 0,
        thumbWidth: 80,
        transitionTime: 350,
    };

    constructor(props: Props) {
        super(props);

        this.state = {
            selectedItem: props.selectedItem,
            swiping: false,
            showArrows: false,
            firstItem: 0,
            visibleItems: 0,
            lastPosition: 0,
        };
    }

    componentDidMount() {
        this.setupThumbs();
    }

    UNSAFE_componentWillReceiveProps(props: Props) {
        if (props.selectedItem !== this.state.selectedItem) {
            this.setState({
                selectedItem: props.selectedItem,
                firstItem: this.getFirstItem(props.selectedItem),
            });
        }
    }

    componentDidUpdate(prevProps: Props) {
        if (this.props.children === prevProps.children) {
            return;
        }

        // This will capture any size changes for arrow adjustments etc.
        // usually in the same render cycle so we don't see any flickers
        this.updateSizes();
    }

    componentWillUnmount() {
        this.destroyThumbs();
    }

    setItemsWrapperRef = (node: HTMLDivElement) => {
        this.itemsWrapperRef = node;
    };

    setItemsListRef = (node: HTMLUListElement) => {
        this.itemsListRef = node;
    };

    setThumbsRef = (node: HTMLLIElement, index: number) => {
        if (!this.thumbsRef) {
            this.thumbsRef = [];
        }
        this.thumbsRef[index] = node;
    };

    setupThumbs() {
        // as the widths are calculated, we need to resize
        // the carousel when the window is resized
        getWindow().addEventListener('resize', this.updateSizes);
        // issue #2 - image loading smaller
        getWindow().addEventListener('DOMContentLoaded', this.updateSizes);

        // when the component is rendered we need to calculate
        // the container size to adjust the responsive behaviour
        this.updateSizes();
    }

    destroyThumbs() {
        // removing listeners
        getWindow().removeEventListener('resize', this.updateSizes);
        getWindow().removeEventListener('DOMContentLoaded', this.updateSizes);
    }

    updateSizes = () => {
        if (!this.props.children || !this.itemsWrapperRef || !this.thumbsRef) {
            return;
        }

        const total = this.props.editMode
            ? Children.count(this.props.children) + 2
            : Children.count(this.props.children);
        const wrapperSize = this.itemsWrapperRef.clientWidth;
        const itemSize = this.props.thumbWidth ? this.props.thumbWidth : outerWidth(this.thumbsRef[0]);
        const visibleItems = Math.floor(wrapperSize / itemSize);
        const lastPosition = total - visibleItems;
        const showArrows = visibleItems < total;
        this.setState((_state, props) => ({
            itemSize,
            visibleItems,
            firstItem: showArrows ? this.getFirstItem(props.selectedItem) : 0,
            lastPosition,
            showArrows,
        }));
    };

    handleClickItem = (index: number, item: React.ReactNode, e: React.MouseEvent | React.KeyboardEvent) => {
        if (!isKeyboardEvent(e) || e.key === 'Enter') {
            const handler = this.props.onSelectItem;

            if (typeof handler === 'function') {
                handler(index, item);
            }
        }
    };

    onSwipeStart = () => {
        this.setState({
            swiping: true,
        });
    };

    onSwipeEnd = () => {
        this.setState({
            swiping: false,
        });
    };

    onSwipeMove = (delta: { x: number; y: number }) => {
        let deltaX = delta.x;
        if (!this.state.itemSize || !this.itemsWrapperRef) {
            return false;
        }
        const leftBoundary = 0;

        const currentPosition = -this.state.firstItem * this.state.itemSize;
        const lastLeftBoundary = -this.state.visibleItems * this.state.itemSize;

        // prevent user from swiping left out of boundaries
        if (currentPosition === leftBoundary && deltaX > 0) {
            deltaX = 0;
        }

        // prevent user from swiping right out of boundaries
        if (currentPosition === lastLeftBoundary && deltaX < 0) {
            deltaX = 0;
        }

        const wrapperSize = this.itemsWrapperRef.clientWidth;
        const position = currentPosition + 100 / (wrapperSize / deltaX);
        // if 3d isn't available we will use left to move
        if (this.itemsListRef) {
            ['WebkitTransform', 'MozTransform', 'MsTransform', 'OTransform', 'transform', 'msTransform'].forEach(
                (prop) => {
                    this.itemsListRef!.style[prop as any] = CSSTranslate(position, '%', this.props.axis);
                }
            );
        }

        return true;
    };

    slideRight = (positions?: number) => {
        this.moveTo(this.state.firstItem - (typeof positions === 'number' ? positions : 1));
    };

    slideLeft = (positions?: number) => {
        this.moveTo(this.state.firstItem + (typeof positions === 'number' ? positions : 1));
    };

    moveTo = (position: number) => {
        // position can't be lower than 0
        position = position < 0 ? 0 : position;
        // position can't be higher than last postion
        const lastItemPosition = this.props.editMode ? this.state.lastPosition + 1 : this.state.lastPosition;
        position = position >= lastItemPosition ? this.state.lastPosition : position;

        this.setState({
            firstItem: position,
        });
    };

    getFirstItem(selectedItem: number) {
        let firstItem = selectedItem;

        if (selectedItem >= this.state.lastPosition) {
            firstItem = this.state.lastPosition;
        }

        if (selectedItem < this.state.firstItem + this.state.visibleItems) {
            firstItem = this.state.firstItem;
        }

        if (selectedItem < this.state.firstItem) {
            firstItem = selectedItem;
        }

        return firstItem;
    }

    renderItems() {
        return this.props.children.map((img, index) => {
            const itemClass = klass.ITEM(false, index === this.state.selectedItem);

            const thumbProps = {
                key: index,
                ref: (e: HTMLLIElement) => this.setThumbsRef(e, index),
                className: itemClass,
                onClick: this.handleClickItem.bind(this, index, this.props.children[index]),
                onKeyDown: this.handleClickItem.bind(this, index, this.props.children[index]),
                'aria-label': `${this.props.labels.item} ${index + 1}`,
                style: {
                    width: this.props.thumbWidth,
                    height: this.props.thumbWidth,
                    position: 'relative',
                    overflow: 'visible',
                } as const,
            };

            return (
                <li {...thumbProps} role="button" tabIndex={0}>
                    {img}
                    {this.props.editMode && (
                        <div
                            onClick={(event) => {
                                event.stopPropagation();
                                this.props.onPhotoRemove?.(index);
                            }}
                            style={{
                                width: 30,
                                height: 30,
                                borderRadius: 15,
                                backgroundColor: '#eb5757',
                                position: 'absolute',
                                top: -8,
                                right: -8,
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                boxShadow: '-2px 2px 3px 0px rgba(0,0,0,0.75)',
                            }}
                        >
                            <DeleteIcon style={{ color: 'white', fontSize: 18 }} />
                        </div>
                    )}
                </li>
            );
        });
    }

    handleClick = () => {
        this.imageInputRef.current?.click();
    };

    renderAddPhotoButton() {
        return (
            this.props.editMode && (
                <li style={{ display: 'inline-block', height: this.props.thumbWidth }} key={this.props.children.length}>
                    <input
                        accept="image/*"
                        id="contained-button-file"
                        type="file"
                        onChange={this.props.onPhotoAdd}
                        ref={this.imageInputRef}
                        style={{ display: 'none' }}
                    />
                    <label htmlFor="contained-button-file">
                        <Button
                            style={{ position: 'relative', top: this.props.thumbWidth / 2 - 18 }}
                            variant="contained"
                            startIcon={<AddPhotoAlternateIcon />}
                            onClick={this.handleClick}
                        >
                            ADD IMAGE
                        </Button>
                    </label>
                </li>
            )
        );
    }

    render() {
        if (!this.props.children) {
            return null;
        }

        const isSwipeable = Children.count(this.props.children) > 1;

        // show left arrow?
        const hasPrev = this.state.showArrows && this.state.firstItem > 0;
        // show right arrow
        const hasNext = this.state.showArrows && this.state.firstItem < this.state.lastPosition;
        // obj to hold the transformations and styles
        let itemListStyles = {};

        const currentPosition = -this.state.firstItem * (this.state.itemSize || 0);

        const transformProp = CSSTranslate(currentPosition, 'px', this.props.axis);

        const transitionTime = this.props.transitionTime + 'ms';

        itemListStyles = {
            WebkitTransform: transformProp,
            MozTransform: transformProp,
            MsTransform: transformProp,
            OTransform: transformProp,
            transform: transformProp,
            msTransform: transformProp,
            WebkitTransitionDuration: transitionTime,
            MozTransitionDuration: transitionTime,
            MsTransitionDuration: transitionTime,
            OTransitionDuration: transitionTime,
            transitionDuration: transitionTime,
            msTransitionDuration: transitionTime,
        };

        return (
            <div className={klass.CAROUSEL(false)}>
                <div className={klass.WRAPPER(false)} ref={this.setItemsWrapperRef}>
                    <button
                        type="button"
                        className={klass.ARROW_PREV(!hasPrev)}
                        onClick={() => this.slideRight()}
                        aria-label={this.props.labels.leftArrow}
                    />
                    {isSwipeable ? (
                        <Swipe
                            tagName="ul"
                            className={klass.SLIDER(false, this.state.swiping)}
                            onSwipeLeft={this.slideLeft}
                            onSwipeRight={this.slideRight}
                            onSwipeMove={this.onSwipeMove}
                            onSwipeStart={this.onSwipeStart}
                            onSwipeEnd={this.onSwipeEnd}
                            style={itemListStyles}
                            innerRef={this.setItemsListRef}
                        >
                            {this.renderItems()}
                            {this.renderAddPhotoButton()}
                        </Swipe>
                    ) : (
                        <ul
                            className={klass.SLIDER(false, this.state.swiping)}
                            ref={(node: HTMLUListElement) => this.setItemsListRef(node)}
                            style={itemListStyles}
                        >
                            {this.renderItems()}
                            {this.renderAddPhotoButton()}
                        </ul>
                    )}
                    <button
                        type="button"
                        className={klass.ARROW_NEXT(!hasNext)}
                        onClick={() => this.slideLeft()}
                        aria-label={this.props.labels.rightArrow}
                    />
                </div>
            </div>
        );
    }
}
