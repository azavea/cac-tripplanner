import logging

from django import template

register = template.Library()

logger = logging.getLogger(__name__)


def get_destination_from_obj(destination):
    """Helper to get a destination from a destination, event, or tour.

    For events and tours, return the first related destination, if any."""

    if hasattr(destination, 'first_destination'):
        # tour with related destination(s); use the ordered first
        return destination.first_destination
    elif hasattr(destination, 'destinations'):
        # event with related destination(s); use the first
        if destination.destinations.count() > 0:
            return destination.destinations.first()
        else:
            # event without a destination
            return None
    else:
        # not an event or tour
        return destination


@register.simple_tag(name='has_activity')
def has_activity(destination, activity_name):
    """Test if a given activity is available at the passed destination/event/tour."""
    return destination.has_activity(activity_name) if destination else False


@register.simple_tag(name='get_directions_id')
def get_directions_id(obj):
    """Get place ID for directions, which is place ID for the first associated destination,
    if an event or tour."""
    destination = get_destination_from_obj(obj)
    return destination.id if destination else None


@register.simple_tag(name='get_destination_x')
def get_destination_x(obj):
    destination = get_destination_from_obj(obj)
    return destination.point.x if destination and destination.point else None


@register.simple_tag(name='get_destination_y')
def get_destination_y(obj):
    destination = get_destination_from_obj(obj)
    return destination.point.y if destination and destination.point else None
