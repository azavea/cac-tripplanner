import json
import logging

from django import template

from destinations.models import Destination, Event, Tour

register = template.Library()

logger = logging.getLogger(__name__)


def get_destination_from_obj(destination):
    """Helper to get a destination from a destination, event, or tour.

    For events and tours, return the first related destination, if any."""

    if hasattr(destination, 'first_destination'):
        # tour with related destination(s); use the ordered first
        return destination.first_destination
    else:
        # not an event or tour
        return destination


@register.simple_tag(name='has_activity')
def has_activity(destination, activity_name):
    """Test if a given activity is available at the passed destination/event/tour."""
    return destination.has_activity(activity_name) if destination else False


@register.simple_tag(name='get_directions_id')
def get_directions_id(obj):
    """Get ID for a Destination, Event, or Tour, prefixed by its type.

    Prefix IDs to ensure uniqueness across them.
    These must match the prefixed IDs set in JS by the `cardId` Handlebars function,
    and in the autocomplete results.
    """
    if not obj:
        return None
    if isinstance(obj, Destination):
        prefix = 'place'
    elif isinstance(obj, Event):
        prefix = 'event'
    elif isinstance(obj, Tour):
        prefix = 'tour'
    else:
        raise ValueError('Object must be a Destination, Event, or Tour')
    return prefix + '_' + str(obj.id)


@register.simple_tag(name='get_destination_x')
def get_destination_x(obj):
    destination = get_destination_from_obj(obj)
    return destination.point.x if destination and destination.point else None


@register.simple_tag(name='get_destination_y')
def get_destination_y(obj):
    destination = get_destination_from_obj(obj)
    return destination.point.y if destination and destination.point else None


@register.simple_tag(name='get_place_ids')
def get_place_ids(obj):
    """Get the IDs for the Destinations related to a Tour or Event as a JSON array."""
    if not obj:
        return json.dumps([])
    if hasattr(obj, 'tour_destinations'):
        return json.dumps([td.destination.id for td in obj.tour_destinations.all()])
    elif hasattr(obj, 'event_destinations'):
        return json.dumps([ed.destination.id for ed in obj.event_destinations.all()])
    else:
        # return a single place ID for a Destination
        return json.dumps([obj.id])
